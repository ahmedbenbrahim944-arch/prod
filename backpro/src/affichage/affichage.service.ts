// src/affichage/affichage.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Planification } from '../semaine/entities/planification.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { Affectation } from '../affectation/entities/affectation.entity';
import { ProductionRecord } from '../production/entities/production-record.entity';
import { GetAffichageDto } from './dto/get-affichage.dto';
import { GetOverviewDto } from './dto/get-overview.dto';

@Injectable()
export class AffichageService {
  constructor(
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,

    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,

    @InjectRepository(Affectation)
    private affectationRepository: Repository<Affectation>,

    @InjectRepository(ProductionRecord)
    private productionRepository: Repository<ProductionRecord>,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPERS PRIVÉS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Normalise la ligne : extrait le préfixe L04 depuis L04:RXT1, L04-RXT1, etc.
   */
  private normalizeLigne(ligne: string): string {
    if (!ligne) return '';
    const match = ligne.trim().toUpperCase().match(/^(L\d{2})/);
    return match ? match[1] : ligne.trim().toUpperCase();
  }

  /**
   * Convertir une date (ex: "2026-04-06") en nom de jour français
   */
  private getJourFromDate(dateStr: string): string {
    const date = new Date(dateStr);
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return jours[date.getDay()];
  }

  /**
   * Trouver la semaine qui contient une date donnée
   */
  private async findSemaineByDate(dateStr: string): Promise<Semaine | null> {
    const date = new Date(dateStr);
    const semaines = await this.semaineRepository.find();
    for (const semaine of semaines) {
      const debut = new Date(semaine.dateDebut);
      const fin = new Date(semaine.dateFin);
      debut.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      if (date >= debut && date <= fin) {
        return semaine;
      }
    }
    return null;
  }

  /**
   * Calcule les KPIs de production pour une ligne et une date données
   * (méthode partagée entre getAffichage et getOverview)
   */
  private async computeKpisLigne(
    lignePrefix: string,
    planificationsActives: Planification[],
    date: string,
  ) {
    // Quantité planifiée totale
    const totalQtePlanifiee = planificationsActives.reduce((sum, p) => {
      return sum + (p.qteModifiee > 0 ? p.qteModifiee : p.qtePlanifiee);
    }, 0);

    // Records de production du jour
    const dateDebut = new Date(date);
    dateDebut.setHours(0, 0, 0, 0);
    const dateFin = new Date(date);
    dateFin.setHours(23, 59, 59, 999);

    const productionRecords = await this.productionRepository
      .createQueryBuilder('pr')
      .where('pr.ligne LIKE :ligne', { ligne: `${lignePrefix}%` })
      .andWhere('pr.dateScan BETWEEN :debut AND :fin', {
        debut: dateDebut,
        fin: dateFin,
      })
      .getMany();

    const totalQteProduite = productionRecords.reduce(
      (sum, r) => sum + r.quantite,
      0,
    );

    const productivite =
      totalQtePlanifiee > 0
        ? Math.round((totalQteProduite / totalQtePlanifiee) * 10000) / 100
        : 0;

    return {
      totalQtePlanifiee,
      totalQteProduite,
      productivite,
      nbScans: productionRecords.length,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ENDPOINT 1 : Affichage détaillé d'une ligne
  // ══════════════════════════════════════════════════════════════════════════

  async getAffichage(dto: GetAffichageDto) {
    const { date, ligne } = dto;
    const lignePrefix = this.normalizeLigne(ligne);

    const semaine = await this.findSemaineByDate(date);
    if (!semaine) {
      throw new NotFoundException(
        `Aucune semaine trouvée pour la date "${date}". Vérifiez que cette date est couverte par une semaine planifiée.`,
      );
    }

    const jour = this.getJourFromDate(date);
    if (jour === 'dimanche') {
      throw new NotFoundException(`Le dimanche n'est pas un jour de travail planifié.`);
    }

    const planifications = await this.planificationRepository
      .createQueryBuilder('p')
      .where('p.semaine = :semaine', { semaine: semaine.nom })
      .andWhere('p.jour = :jour', { jour })
      .andWhere('p.ligne LIKE :ligne', { ligne: `${lignePrefix}%` })
      .getMany();

    const planificationsActives = planifications.filter(
      (p) => p.qtePlanifiee > 0 || p.qteModifiee > 0,
    );

    const kpis = await this.computeKpisLigne(lignePrefix, planificationsActives, date);

    const detailReferences = planificationsActives.map((p) => ({
      reference: p.reference,
      of: p.of,
      qtePlanifiee: p.qtePlanifiee,
      qteModifiee: p.qteModifiee,
      qteSource: p.qteModifiee > 0 ? p.qteModifiee : p.qtePlanifiee,
      emballage: p.emballage,
      nbOperateurs: p.nbOperateurs,
    }));

    const affectations = await this.affectationRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.ouvrier', 'ouvrier')
      .leftJoinAndSelect('a.phases', 'phases')
      .where('a.ligne LIKE :ligne', { ligne: `${lignePrefix}%` })
      .getMany();

    const nbOuvriers = affectations.length;
    const ouvriersList = affectations.map((a) => ({
      matricule: a.ouvrier.matricule,
      nomPrenom: a.ouvrier.nomPrenom,
      estCapitaine: a.estCapitaine,
      phases: (a.phases ?? []).map((ph) => ({
        phase: ph.phase,
        heures: Number(ph.heures),
      })),
    }));

    // Records de production pour le détail
    const dateDebut = new Date(date);
    dateDebut.setHours(0, 0, 0, 0);
    const dateFin = new Date(date);
    dateFin.setHours(23, 59, 59, 999);

    const productionRecords = await this.productionRepository
      .createQueryBuilder('pr')
      .where('pr.ligne LIKE :ligne', { ligne: `${lignePrefix}%` })
      .andWhere('pr.dateScan BETWEEN :debut AND :fin', {
        debut: dateDebut,
        fin: dateFin,
      })
      .orderBy('pr.dateScan', 'ASC')
      .getMany();

    return {
      message: `Affichage pour la ligne "${ligne}" le ${date}`,
      date,
      jour,
      semaine: {
        id: semaine.id,
        nom: semaine.nom,
        dateDebut: semaine.dateDebut,
        dateFin: semaine.dateFin,
      },
      ligne,
      kpis: {
        productivite: `${kpis.productivite}%`,
        productiviteValeur: kpis.productivite,
        nbOuvriers,
        totalQtePlanifiee: kpis.totalQtePlanifiee,
        totalQteProduite: kpis.totalQteProduite,
        delta: kpis.totalQteProduite - kpis.totalQtePlanifiee,
      },
      planification: {
        nbReferences: planificationsActives.length,
        references: detailReferences,
      },
      ouvriers: {
        total: nbOuvriers,
        capitaine: ouvriersList.find((o) => o.estCapitaine) ?? null,
        liste: ouvriersList,
      },
      production: {
        nbScans: productionRecords.length,
        enregistrements: productionRecords.map((r) => ({
          id: r.id,
          reference: r.reference,
          quantite: r.quantite,
          dateScan: r.dateScan,
        })),
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ENDPOINT 2 : Vue globale — toutes les lignes d'une journée
  // ══════════════════════════════════════════════════════════════════════════

  async getOverview(dto: GetOverviewDto) {
    const { date } = dto;

    // ── 1. Semaine et jour ────────────────────────────────────────────────
    const semaine = await this.findSemaineByDate(date);
    if (!semaine) {
      throw new NotFoundException(
        `Aucune semaine trouvée pour la date "${date}".`,
      );
    }

    const jour = this.getJourFromDate(date);
    if (jour === 'dimanche') {
      throw new NotFoundException(`Le dimanche n'est pas un jour de travail planifié.`);
    }

    // ── 2. Toutes les planifications actives du jour ───────────────────────
    const toutesLesPlanifications = await this.planificationRepository
      .createQueryBuilder('p')
      .where('p.semaine = :semaine', { semaine: semaine.nom })
      .andWhere('p.jour = :jour', { jour })
      .andWhere('(p.qtePlanifiee > 0 OR p.qteModifiee > 0)')
      .getMany();

    // ── 3. Lignes uniques triées ──────────────────────────────────────────
    const lignesUniques = [...new Set(
      toutesLesPlanifications.map((p) => p.ligne).filter(Boolean),
    )].sort();

    // ── 4. KPIs par ligne en parallèle ────────────────────────────────────
    const lignesData = await Promise.all(
      lignesUniques.map(async (ligne) => {
        const lignePrefix = this.normalizeLigne(ligne);

        // Planifications actives pour cette ligne
        const planifLigne = toutesLesPlanifications.filter(
          (p) => this.normalizeLigne(p.ligne) === lignePrefix,
        );

        const kpis = await this.computeKpisLigne(lignePrefix, planifLigne, date);

        return {
          ligne,
          lignePrefix,
          totalQtePlanifiee: kpis.totalQtePlanifiee,
          totalQteProduite: kpis.totalQteProduite,
          productivite: kpis.productivite,
          nbScans: kpis.nbScans,
          delta: kpis.totalQteProduite - kpis.totalQtePlanifiee,
          statut:
            kpis.productivite >= 85
              ? 'success'
              : kpis.productivite >= 60
              ? 'warning'
              : 'danger',
        };
      }),
    );

    // ── 5. KPIs globaux de la journée ─────────────────────────────────────
    const totalPlanifie = lignesData.reduce((s, l) => s + l.totalQtePlanifiee, 0);
    const totalProduit  = lignesData.reduce((s, l) => s + l.totalQteProduite, 0);
    const productiviteGlobale =
      totalPlanifie > 0
        ? Math.round((totalProduit / totalPlanifie) * 10000) / 100
        : 0;

    return {
      date,
      jour,
      semaine: {
        id: semaine.id,
        nom: semaine.nom,
        dateDebut: semaine.dateDebut,
        dateFin: semaine.dateFin,
      },
      global: {
        nbLignes: lignesData.length,
        totalQtePlanifiee: totalPlanifie,
        totalQteProduite: totalProduit,
        productiviteGlobale,
        delta: totalProduit - totalPlanifie,
      },
      lignes: lignesData,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ENDPOINT 3 : Liste des lignes disponibles
  // ══════════════════════════════════════════════════════════════════════════

  async getLignes(): Promise<string[]> {
    const result = await this.planificationRepository
      .createQueryBuilder('planification')
      .select('DISTINCT planification.ligne', 'ligne')
      .where('planification.ligne IS NOT NULL')
      .andWhere("planification.ligne != ''")
      .orderBy('planification.ligne', 'ASC')
      .getRawMany();

    const lignes = result
      .map((item) => String(item.ligne).trim())
      .filter((ligne) => ligne.length > 0);

    return [...new Set(lignes)].sort();
  }
}