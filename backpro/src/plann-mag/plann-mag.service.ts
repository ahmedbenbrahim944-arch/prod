// src/plann-mag/plann-mag.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Planification }  from '../semaine/entities/planification.entity';
import { Semaine }         from '../semaine/entities/semaine.entity';
import { MatierePremiere } from './entities/matiere-premiere.entity';
import { DocumentServi }   from './entities/document-servi.entity';
import { CreateMatierePremiereDto } from './dto/create-matiere-premiere.dto';
import { UpdateMatierePremiereDto } from './dto/update-matiere-premiere.dto';
import { SearchMatierePremiereDto } from './dto/search-matiere-premiere.dto';

// ─── Types retournés par searchByDate ────────────────────────────────────────

interface MpRowItem {
  refMp:         string;
  descriptionMp: string;
  coeffImpiego:  number;
  qteNecessaire: number;
}

interface OfsDetail {
  of:            string;
  qtePlanifiee:  number;
  codeDocument:  string;
}

interface RefDetail {
  ligne:        string;
  reference:    string;
  ofs:          OfsDetail[];
  totalQte:     number;
  codeDocument: string;
  mpRows:       MpRowItem[];
}

interface LigneGroupItem {
  ligne: string;
  refs:  RefDetail[];
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PlannMagService {
  constructor(
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,

    @InjectRepository(MatierePremiere)
    private matierePremiereRepository: Repository<MatierePremiere>,

    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,

    @InjectRepository(DocumentServi)
    private documentServiRepository: Repository<DocumentServi>,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD ─── MATIÈRE PREMIÈRE
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /plann-mag/matieres — liste complète */
  async getAllMatieresPremières(): Promise<MatierePremiere[]> {
    return this.matierePremiereRepository.find({
      order: { ligne: 'ASC', referenceLigne: 'ASC', refMp: 'ASC' },
    });
  }

  /**
   * POST /plann-mag/matieres/search — recherche multicritères
   * Tous les filtres sont optionnels et insensibles à la casse (LIKE %valeur%)
   */
  async searchMatieresPremières(
    dto: SearchMatierePremiereDto,
  ): Promise<{ total: number; data: MatierePremiere[] }> {
    const where: any = {};

    if (dto.ligne)          where.ligne          = Like(`%${dto.ligne}%`);
    if (dto.referenceLigne) where.referenceLigne = Like(`%${dto.referenceLigne}%`);
    if (dto.refMp)          where.refMp          = Like(`%${dto.refMp}%`);
    if (dto.description)    where.description    = Like(`%${dto.description}%`);

    const [data, total] = await this.matierePremiereRepository.findAndCount({
      where,
      order: { ligne: 'ASC', referenceLigne: 'ASC', refMp: 'ASC' },
    });

    return { total, data };
  }

  /** GET /plann-mag/matieres/:id — détail d'une MP */
  async getMatierePremiere(id: number): Promise<MatierePremiere> {
    const mp = await this.matierePremiereRepository.findOne({ where: { id } });
    if (!mp) {
      throw new NotFoundException(`Matière première avec l'id ${id} introuvable`);
    }
    return mp;
  }

  /** POST /plann-mag/matieres — créer une nouvelle MP */
  async createMatierePremiere(
    dto: CreateMatierePremiereDto,
  ): Promise<MatierePremiere> {
    const mp = this.matierePremiereRepository.create(dto);
    return this.matierePremiereRepository.save(mp);
  }

  /** PATCH /plann-mag/matieres/:id — modifier une MP existante */
  async updateMatierePremiere(
    id: number,
    dto: UpdateMatierePremiereDto,
  ): Promise<MatierePremiere> {
    const mp = await this.getMatierePremiere(id);
    Object.assign(mp, dto);
    return this.matierePremiereRepository.save(mp);
  }

  /** DELETE /plann-mag/matieres/:id — supprimer une MP */
  async deleteMatierePremiere(id: number): Promise<{ message: string }> {
    const mp = await this.getMatierePremiere(id);
    await this.matierePremiereRepository.remove(mp);
    return { message: `Matière première ${id} supprimée avec succès` };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOUVEAU ─── RECHERCHE PAR DATE (OF optionnel), groupé ligne → référence
  // ══════════════════════════════════════════════════════════════════════════
  async searchByDate(annee: string, date: string, of?: string) {
    const day   = parseInt(date.substring(0, 2), 10);
    const month = parseInt(date.substring(2, 4), 10);
    const year  = parseInt(annee, 10);

    const targetDate = new Date(year, month - 1, day);
    const jourFr     = this.getJourFrancais(targetDate.getDay());

    if (!jourFr) {
      throw new NotFoundException(
        `La date ${date}/${annee} tombe un dimanche (jour non travaillé)`,
      );
    }

    // ── Trouver la semaine correspondante ──────────────────────────────────
    const semaines     = await this.semaineRepository.find();
    const semaineMatch = semaines.find(s => {
      const debut = new Date(s.dateDebut);
      const fin   = new Date(s.dateFin);
      debut.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      targetDate.setHours(12, 0, 0, 0);
      return targetDate >= debut && targetDate <= fin;
    });

    if (!semaineMatch) {
      throw new NotFoundException(
        `Aucune semaine trouvée couvrant la date ${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`,
      );
    }

    // ── Récupérer les planifications (filtre OF optionnel) ─────────────────
    const whereClause: any = { semaine: semaineMatch.nom, jour: jourFr };
    if (of) whereClause.of = of;

    const planifications       = await this.planificationRepository.find({ where: whereClause });
    const planificationsActives = planifications.filter(p => p.qtePlanifiee > 0);

    if (planificationsActives.length === 0) {
      throw new NotFoundException(
        `Aucun OF planifié pour le ${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`,
      );
    }

    // ── Grouper par ligne → référence ──────────────────────────────────────
    const ligneRefMap = new Map<string, Map<string, {
      ligne:     string;
      reference: string;
      ofs:       OfsDetail[];
      totalQte:  number;
      matieres:  any[];
    }>>();

    for (const plan of planificationsActives) {
      if (!ligneRefMap.has(plan.ligne)) {
        ligneRefMap.set(plan.ligne, new Map());
      }
      const refMap = ligneRefMap.get(plan.ligne)!;

      if (!refMap.has(plan.reference)) {
        const ligneNorm = plan.ligne.replace(/\s/g, '');
        const refNorm   = plan.reference.replace(/\s/g, '');

        const matieres = await this.matierePremiereRepository
          .createQueryBuilder('mp')
          .where("REPLACE(mp.ligne, ' ', '') = :ligne",           { ligne: ligneNorm })
          .andWhere("REPLACE(mp.reference_ligne, ' ', '') = :ref", { ref: refNorm })
          .getMany();

        refMap.set(plan.reference, {
          ligne:     plan.ligne,
          reference: plan.reference,
          ofs:       [],
          totalQte:  0,
          matieres,
        });
      }

      const entry = refMap.get(plan.reference)!;

      // ── Sécurisation OF null/vide ──────────────────────────────────────
      // Certaines planifications n'ont pas encore d'OF assigné en base.
      // On normalise : null / undefined / '   ' → chaîne vide.
      const ofValue = (plan.of ?? '').toString().trim();
      const codeDoc = ofValue
        ? `G${ofValue}${date}`   // OF présent  → ex: G0697390704
        : `G${date}`;            // OF absent   → ex: G0704 (date seule)

      entry.ofs.push({
        of:           ofValue,
        qtePlanifiee: plan.qtePlanifiee,
        codeDocument: codeDoc,
      });
      entry.totalQte += plan.qtePlanifiee;
    }

    // ── Construire la réponse ──────────────────────────────────────────────
    const ligneGroups: LigneGroupItem[] = [];
    const allOfsSet = new Set<string>();
    let totalMp = 0;

    for (const [ligne, refMap] of ligneRefMap) {
      const refs: RefDetail[] = [];

      for (const [, entry] of refMap) {
        entry.ofs.forEach(o => allOfsSet.add(o.of));

        const mpRows: MpRowItem[] = entry.matieres.map(mp => {
          const coeff         = Number(mp.coeffImpiego);
          const qteNecessaire = Math.ceil(entry.totalQte * coeff * 1000) / 1000;
          return {
            refMp:         mp.refMp,
            descriptionMp: mp.description,
            coeffImpiego:  coeff,
            qteNecessaire,
          };
        });

        totalMp += mpRows.length;

        refs.push({
          ligne:        entry.ligne,
          reference:    entry.reference,
          ofs:          entry.ofs,
          totalQte:     entry.totalQte,
          codeDocument: entry.ofs.length > 0 ? entry.ofs[0].codeDocument : `G${date}`,
          mpRows,
        });
      }

      if (refs.length > 0) {
        refs.sort((a, b) => a.reference.localeCompare(b.reference));
        ligneGroups.push({ ligne, refs });
      }
    }

    ligneGroups.sort((a, b) => a.ligne.localeCompare(b.ligne));

    if (ligneGroups.length === 0) {
      throw new NotFoundException(
        `Planifications trouvées mais aucune MP associée pour cette date`,
      );
    }

    const dateFormatee = `${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`;

    return {
      annee,
      date,
      dateFormatee,
      jour:      jourFr,
      semaine:   semaineMatch.nom,
      totalMp,
      totalOfs:  allOfsSet.size,
      ofFilter:  of || null,
      ligneGroups,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OF DISPONIBLES PAR DATE
  // ══════════════════════════════════════════════════════════════════════════
  async getOfsByDate(annee: string, date: string) {
    const day   = parseInt(date.substring(0, 2), 10);
    const month = parseInt(date.substring(2, 4), 10);
    const year  = parseInt(annee, 10);

    const targetDate = new Date(year, month - 1, day);
    const jourFr     = this.getJourFrancais(targetDate.getDay());

    if (!jourFr) {
      throw new NotFoundException(
        `La date ${date}/${annee} tombe un dimanche (jour non travaillé)`,
      );
    }

    const semaines     = await this.semaineRepository.find();
    const semaineMatch = semaines.find(s => {
      const debut = new Date(s.dateDebut);
      const fin   = new Date(s.dateFin);
      debut.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      targetDate.setHours(12, 0, 0, 0);
      return targetDate >= debut && targetDate <= fin;
    });

    if (!semaineMatch) {
      throw new NotFoundException(
        `Aucune semaine trouvée couvrant la date ${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`,
      );
    }

    const planifications = await this.planificationRepository.find({
      where: { semaine: semaineMatch.nom, jour: jourFr },
    });
    const planificationsActives = planifications.filter(p => p.qtePlanifiee > 0);

    const ofs = [...new Set(planificationsActives.map(p => p.of))].sort();

    return {
      annee,
      date,
      dateFormatee: `${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`,
      jour:    jourFr,
      semaine: semaineMatch.nom,
      totalOfs: ofs.length,
      ofs,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCAN DOUCHETTE
  // ══════════════════════════════════════════════════════════════════════════
  async scanDocument(codeDocument: string, serviPar?: string) {
    const existing = await this.documentServiRepository.findOne({ where: { codeDocument } });

    if (existing) {
      throw new ConflictException({
        alreadyServed: true,
        message:      `Ce document a déjà été servi`,
        codeDocument,
        serviLe:      existing.serviLe,
        serviPar:     existing.serviPar,
        ligne:        existing.ligne,
        semaine:      existing.semaine,
        dateFormatee: existing.dateFormatee,
      });
    }

    const withoutG = codeDocument.substring(1);
    const dateDoc  = withoutG.substring(withoutG.length - 4);
    const of       = withoutG.substring(0, withoutG.length - 4);

    const currentYear = new Date().getFullYear();
    let planningResult: any = null;

    for (const year of [currentYear, currentYear + 1, currentYear - 1]) {
      try {
        planningResult = await this.searchByOfAndDate(year.toString(), of, dateDoc);
        if (planningResult) break;
      } catch {
        continue;
      }
    }

    if (!planningResult) {
      throw new NotFoundException(`Aucun planning trouvé pour le code document ${codeDocument}`);
    }

    const premierePlan = planningResult.planning[0];
    const docServi = this.documentServiRepository.create({
      codeDocument,
      ligne:        premierePlan?.ligne || '',
      of,
      dateDoc,
      dateFormatee: planningResult.dateFormatee,
      semaine:      planningResult.semaine,
      serviPar:     serviPar || null,
    });

    const saved = await this.documentServiRepository.save(docServi);

    return {
      success:       true,
      alreadyServed: false,
      message:       'Planning marqué comme servi avec succès ✅',
      codeDocument,
      serviLe:       saved.serviLe,
      serviPar:      saved.serviPar,
      ...planningResult,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RECHERCHE PAR OF + DATE (ancien endpoint conservé)
  // ══════════════════════════════════════════════════════════════════════════
  async searchByOfAndDate(annee: string, of: string, date: string) {
    const day   = parseInt(date.substring(0, 2), 10);
    const month = parseInt(date.substring(2, 4), 10);
    const year  = parseInt(annee, 10);

    const targetDate = new Date(year, month - 1, day);
    const jourFr     = this.getJourFrancais(targetDate.getDay());

    if (!jourFr) {
      throw new NotFoundException(`La date ${date}/${annee} tombe un dimanche (jour non travaillé)`);
    }

    const semaines     = await this.semaineRepository.find();
    const semaineMatch = semaines.find(s => {
      const debut = new Date(s.dateDebut);
      const fin   = new Date(s.dateFin);
      debut.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      targetDate.setHours(12, 0, 0, 0);
      return targetDate >= debut && targetDate <= fin;
    });

    if (!semaineMatch) {
      throw new NotFoundException(
        `Aucune semaine trouvée couvrant la date ${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`,
      );
    }

    const planifications        = await this.planificationRepository.find({
      where: { semaine: semaineMatch.nom, of, jour: jourFr },
    });
    const planificationsActives = planifications.filter(p => p.qtePlanifiee > 0);

    if (planificationsActives.length === 0) {
      throw new NotFoundException(`Aucune planification active trouvée pour OF=${of}, date=${day}/${month}/${year}`);
    }

    const codeDocument = `G${of}${date}`;
    const result: any[] = [];

    for (const plan of planificationsActives) {
      const ligneNorm = plan.ligne.replace(/\s/g, '');
      const refNorm   = plan.reference.replace(/\s/g, '');

      const matieres = await this.matierePremiereRepository
        .createQueryBuilder('mp')
        .where("REPLACE(mp.ligne, ' ', '') = :ligne",           { ligne: ligneNorm })
        .andWhere("REPLACE(mp.reference_ligne, ' ', '') = :ref", { ref: refNorm })
        .getMany();

      if (matieres.length === 0) continue;

      const qtePlanifiee = plan.qtePlanifiee;

      for (const mp of matieres) {
        const coeff         = Number(mp.coeffImpiego);
        const qteNecessaire = Math.ceil(qtePlanifiee * coeff * 1000) / 1000;

        result.push({
          semaine:       semaineMatch.nom,
          dateDebut:     semaineMatch.dateDebut,
          dateFin:       semaineMatch.dateFin,
          jour:          plan.jour,
          dateFormatee:  `${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`,
          codeDocument,
          ligne:         plan.ligne,
          reference:     plan.reference,
          of:            plan.of,
          qtePlanifiee,
          refMp:         mp.refMp,
          descriptionMp: mp.description,
          coeffImpiego:  coeff,
          qteNecessaire,
        });
      }
    }

    if (result.length === 0) {
      throw new NotFoundException(`Planification trouvée mais aucune MP associée pour OF=${of}`);
    }

    return {
      codeDocument,
      annee,
      of,
      date,
      dateFormatee: `${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`,
      jour:    jourFr,
      semaine: semaineMatch.nom,
      totalMp: result.length,
      planning: result,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PLANNING PAR SEMAINE
  // ══════════════════════════════════════════════════════════════════════════
  async getPlanningMagasin(semaine: string) {
    const planifications = await this.planificationRepository.find({
      where: { semaine },
      order: { ligne: 'ASC', reference: 'ASC', jour: 'ASC' },
    });

    if (!planifications || planifications.length === 0) {
      throw new NotFoundException(`Aucune planification trouvée pour la semaine "${semaine}"`);
    }

    const planificationsActives = planifications.filter(p => p.qtePlanifiee > 0);

    if (planificationsActives.length === 0) {
      return { semaine, totalLignes: 0, planning: [], message: 'Aucune planification avec quantité > 0' };
    }

    const result: any[] = [];

    for (const plan of planificationsActives) {
      const ligneNorm = plan.ligne.replace(/\s/g, '');
      const refNorm   = plan.reference.replace(/\s/g, '');

      const matieres = await this.matierePremiereRepository
        .createQueryBuilder('mp')
        .where("REPLACE(mp.ligne, ' ', '') = :ligne",           { ligne: ligneNorm })
        .andWhere("REPLACE(mp.reference_ligne, ' ', '') = :ref", { ref: refNorm })
        .getMany();

      if (matieres.length === 0) continue;

      for (const mp of matieres) {
        const coeff         = Number(mp.coeffImpiego);
        const qteNecessaire = Math.ceil(plan.qtePlanifiee * coeff * 1000) / 1000;

        result.push({
          semaine:       plan.semaine,
          jour:          plan.jour,
          ligne:         plan.ligne,
          reference:     plan.reference,
          of:            plan.of,
          qtePlanifiee:  plan.qtePlanifiee,
          refMp:         mp.refMp,
          descriptionMp: mp.description,
          coeffImpiego:  coeff,
          qteNecessaire,
        });
      }
    }

    return { semaine, totalLignes: result.length, planning: result };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════════════════════════════════════════
  private getJourFrancais(dayIndex: number): string | null {
    const jours: Record<number, string> = {
      1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi',
    };
    return jours[dayIndex] ?? null;
  }
}