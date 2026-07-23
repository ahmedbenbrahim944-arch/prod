import { Injectable, Logger , NotFoundException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Pointage } from './entities/pointage.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Badge } from 'src/autosaisie/entities/badge.entity';
import { Employee } from '../employee/entities/employee.entity';
import { StatutManuelService } from '../statut-manuel/statut-manuel.service'; // ✅ NOUVEAU
import { TypeStatutManuel, StatutManuel } from 'src/statut-manuel/entites/statut-manuel.entity';
import { Affectation } from 'src/affectation/entities/affectation.entity';

type CategorieAbsence = 'conge' | 'maladie' | 'injustifiee' | 'autre' | 'sans_motif';

const CATEGORIES_ABSENCE: Record<string, CategorieAbsence> = {
  conge: 'conge',
  mission: 'conge',
  raison_familiale: 'conge',
  maladie: 'maladie',
  absence_non_justifiee: 'injustifiee',
  attente_justification: 'injustifiee',
  autre: 'autre',
  fin_contrat: 'autre',
  mise_a_pied: 'autre',
};

function categoriserAbsence(statut?: TypeStatutManuel | null): CategorieAbsence {
  if (!statut) return 'sans_motif';
  return CATEGORIES_ABSENCE[statut] || 'autre';
}

export interface LigneEffectifDetaille {
  ligne: string;
  poste: string;
  totalAffectes: number;
  presents: number;
  tauxCouverture: number; // 0-100
  seuilAlerte: number;
  enAlerte: boolean;
  absencesParCategorie: Record<CategorieAbsence, number>;
  presentsListe: RecapPosteItem[];
  absentsListe: (RecapPosteItem & { categorie: CategorieAbsence })[];
}

// ✅ Type étendu — inclut tous les statuts manuels possibles
export type StatutPresence =
  | 'present'
  | 'absent'
  | 'conge'
  | 'maladie'
  | 'mission'
  | 'autre'
  | 'badge_oublie'
  | 'absence_non_justifiee'
  | 'attente_justification'
  | 'raison_familiale'
  | 'fin_contrat'
  | 'mise_a_pied';

// ── Statuts manuels qui doivent être comptés comme "présent" ──
// (la personne est physiquement là, juste pas de pointage badge)
const STATUTS_PRESENT_MANUEL = new Set<TypeStatutManuel>([
  TypeStatutManuel.PRESENT,
  TypeStatutManuel.BADGE_OUBLIE,
]);

function estStatutPresentManuel(statut?: TypeStatutManuel | null): boolean {
  return !!statut && STATUTS_PRESENT_MANUEL.has(statut);
}

// ── Statuts manuels "justifiés" (congé/maladie/mission/etc.) ──
// La personne n'est ni présente, ni "vraiment" absente : elle est
// couverte par un motif justifié → 3e catégorie distincte au dashboard.
// Les statuts injustifiés (absence_non_justifiee, attente_justification)
// et l'absence de tout statut manuel restent dans la catégorie "Absent".
const STATUTS_JUSTIFIES = new Set<TypeStatutManuel>([
  TypeStatutManuel.CONGE,
  TypeStatutManuel.MALADIE,
  TypeStatutManuel.MISSION,
  TypeStatutManuel.RAISON_FAMILIALE,
  TypeStatutManuel.FIN_CONTRAT,
  TypeStatutManuel.MISE_A_PIED,
  TypeStatutManuel.AUTRE,
]);

function estStatutJustifie(statut?: TypeStatutManuel | null): boolean {
  return !!statut && STATUTS_JUSTIFIES.has(statut);
}

export interface PresenceEmployee {
  matricule: string;
  nomPrenom: string;
  service: string;
  heureEntree?: Date | null;
  heureSortie?: Date | null;
  timbratrice?: string | null;
  statut: StatutPresence;
  commentaire?: string | null; // ✅ NOUVEAU
}
export interface RecapPosteItem {
  matricule: number;
  nomPrenom: string;
  heureEntree?: Date | null;
  timbratrice?: string | null;
  statut: StatutPresence;
  commentaire?: string | null;
}
export interface RecapPoste {
  ligne: string;
  poste: string; // 'jour' | 'nuit'
  totalAffectes: number;
  presents: number;
  absents: number;
  enConge: number; // ✅ NOUVEAU — justifiés (congé/maladie/mission/...)
  presentsListe: RecapPosteItem[];
  absentsListe: RecapPosteItem[];
  enCongeListe: RecapPosteItem[]; // ✅ NOUVEAU
}

// ✅ NOUVEAU — récap jours présent/absent/congé pour une personne sur une période
export interface RecapPersonneJours {
  matricule: string | number;
  nomPrenom: string;
  service?: string;
  joursPresent: number;
  joursAbsent: number;
  joursConge: number;
  datesAbsence: string[];
}

@Injectable()
export class PointageService {
  private readonly logger = new Logger(PointageService.name);

  private readonly servicesAutorises = [
    'Administratif',
    'Maintenance',
    'Magasin',
    'Qualité',
  ];

  constructor(
    @InjectRepository(Pointage)
    private pointageRepo: Repository<Pointage>,
    @InjectRepository(Ouvrier)
    private ouvrierRepo: Repository<Ouvrier>,
    @InjectRepository(Badge)
    private badgeRepo: Repository<Badge>,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
     @InjectRepository(Affectation) // ✅ NOUVEAU
    private affectationRepo: Repository<Affectation>,
    private statutManuelService: StatutManuelService, // ✅ NOUVEAU
  ) {}

  // ─── Reçoit les données d'Andrea ──────────────────────────────
  async importPointages(rows: any[]): Promise<{ imported: number; duplicates: number; ignored: number }> {
    let imported = 0;
    let duplicates = 0;
    let ignored = 0;

    for (const row of rows) {
      let matricule = parseInt(String(row.codice_as400).trim(), 10);
      let nomPrenom = row.risorsa?.trim() || '';

      if (isNaN(matricule) || matricule === 0 || !nomPrenom) {
        const badgeNum = String(parseInt(row.badge, 10));
        const badgeFound = await this.badgeRepo.findOne({
          where: { n_badget: badgeNum },
          relations: ['ouvrier'],
        });

        if (badgeFound && badgeFound.ouvrier) {
          // ── Cas 1 : Badge → Ouvrier ──
          matricule = badgeFound.matricule;
          nomPrenom = badgeFound.ouvrier.nomPrenom;
          this.logger.log(`✅ Badge ${row.badge} → Ouvrier ${matricule} (${nomPrenom})`);
        } else if (badgeFound) {
          // ── Cas 2 : Badge trouvé mais pas d'Ouvrier lié → on tente Employee ──
          const employeeFound = await this.employeeRepo.findOne({
            where: { matricule: String(badgeFound.matricule) },
          });

          if (employeeFound) {
            matricule = badgeFound.matricule;
            nomPrenom = employeeFound.nomPrenom;
            this.logger.log(`✅ Badge ${row.badge} → Employee ${matricule} (${nomPrenom})`);
          } else {
            this.logger.warn(`⚠️ Badge ${row.badge} trouvé mais aucun Ouvrier/Employee lié`);
            matricule = 0;
            nomPrenom = 'Inconnu';
          }
        } else {
          // ── Cas 3 : Badge introuvable ──
          this.logger.warn(`⚠️ Badge ${row.badge} introuvable — sauvegardé sans matricule`);
          matricule = 0;
          nomPrenom = 'Inconnu';
        }
      }

      const dataOra = new Date(row.data_ora);
      dataOra.setHours(dataOra.getHours() + 1);

      const existing = await this.pointageRepo.findOne({
        where: { matricule, dataOra },
      });
      if (existing) {
        duplicates++;
        continue;
      }

      const pointage = new Pointage();
      pointage.badge = row.badge;
      pointage.matricule = matricule;
      pointage.nomPrenom = nomPrenom;
      pointage.dataOra = dataOra;
      pointage.ingressoUscita = row.ingresso_uscita;
      pointage.timbratrice = row.timbratrice;

      await this.pointageRepo.save(pointage);
      imported++;
    }

    this.logger.log(`✅ Import: ${imported} enregistrés, ${duplicates} doublons, ${ignored} ignorés`);
    return { imported, duplicates, ignored };
  }

  // ─── Présents vs Absents du jour (Ouvrier) ─────────────────────
  async getPresentsAujourdhui() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tousOuvriers = await this.ouvrierRepo.find();

    const pointagesJour = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :today', { today })
      .getMany();

    const matriculesPresents = new Set(pointagesJour.map((p) => p.matricule));
    const statutsActifs = await this.statutManuelService.findActifsPourDate(today);

    const presents: any[] = [];
    const absents: any[] = [];
    const enConge: any[] = []; // ✅ NOUVEAU

    for (const o of tousOuvriers) {
      const manuel = statutsActifs.get(String(o.matricule));

      if (matriculesPresents.has(o.matricule)) {
        // ── Présent via pointage physique ──────────────────────
        const entree = pointagesJour.find(
          (p) => p.matricule === o.matricule && p.ingressoUscita === '0100',
        );
        const sortie = pointagesJour.find(
          (p) => p.matricule === o.matricule && p.ingressoUscita === '0000',
        );
        const pointage = entree || sortie;
        presents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          heureEntree: entree?.dataOra || null,
          heureSortie: sortie?.dataOra || null,
          timbratrice: pointage?.timbratrice,
          statut: 'present' as StatutPresence,
          commentaire: null,
        });
      } else if (estStatutPresentManuel(manuel?.statut)) {
        // ✅ présent manuel (présent saisi manuellement OU badge oublié), pas de pointage physique
        presents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          heureEntree: null,
          heureSortie: null,
          timbratrice: null,
          statut: 'present' as StatutPresence,
          commentaire: manuel?.commentaire || null,
        });
      } else if (estStatutJustifie(manuel?.statut)) {
        // ✅ NOUVEAU — en congé / justifié (ni présent, ni vraiment absent)
        enConge.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          statut: manuel!.statut as StatutPresence,
          commentaire: manuel?.commentaire || null,
          dateDebut: manuel?.dateDebut,
          dateFin: manuel?.dateFin,
        });
      } else {
        // ── Absent réel (aucun motif, ou motif injustifié/en attente) ──
        absents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          statut: (manuel?.statut || 'absent') as StatutPresence,
          commentaire: manuel?.commentaire || null,
        });
      }
    }

    return {
      total: presents.length + absents.length + enConge.length,
      presents,
      absents,
      enConge, // ✅ NOUVEAU
    };
  }

  // ─── Présents vs Absents par période (Ouvrier) ─────────────────
  async getPresenceParPeriode(dateDebut: string, dateFin: string) {
    const debut = new Date(dateDebut);
    debut.setHours(0, 0, 0, 0);

    const fin = new Date(dateFin);
    fin.setHours(23, 59, 59, 999);

    const tousOuvriers = await this.ouvrierRepo.find();

    const pointagesPeriode = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :debut', { debut })
      .andWhere('p.dataOra <= :fin', { fin })
      .andWhere('p.ingressoUscita = :entree', { entree: '0100' })
      .getMany();

    const matriculesPresents = new Set(pointagesPeriode.map((p) => p.matricule));
    const statutsActifs = await this.statutManuelService.findActifsPourPeriode(debut, fin);

    const presents: any[] = [];
    const absents: any[] = [];
    const enConge: any[] = []; // ✅ NOUVEAU

    for (const o of tousOuvriers) {
      const manuel = statutsActifs.get(String(o.matricule));

      if (matriculesPresents.has(o.matricule)) {
        const pointage = pointagesPeriode.find((p) => p.matricule === o.matricule);
        presents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          heureEntree: pointage?.dataOra,
          timbratrice: pointage?.timbratrice,
          statut: 'present' as StatutPresence,
          commentaire: null,
        });
      } else if (estStatutPresentManuel(manuel?.statut)) {
        presents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          heureEntree: null,
          timbratrice: null,
          statut: 'present' as StatutPresence,
          commentaire: manuel?.commentaire || null,
        });
      } else if (estStatutJustifie(manuel?.statut)) {
        // ✅ NOUVEAU
        enConge.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          statut: manuel!.statut as StatutPresence,
          commentaire: manuel?.commentaire || null,
          dateDebut: manuel?.dateDebut,
          dateFin: manuel?.dateFin,
        });
      } else {
        absents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          statut: (manuel?.statut || 'absent') as StatutPresence,
          commentaire: manuel?.commentaire || null,
        });
      }
    }

    return {
      dateDebut,
      dateFin,
      total: presents.length + absents.length + enConge.length,
      presents,
      absents,
      enConge, // ✅ NOUVEAU
    };
  }

  // ════════════════════════════════════════════════════════════════
  // Présents/Absents du jour, basé sur Employee (4 services)
  // ════════════════════════════════════════════════════════════════
 async getPresentsAujourdhuiEmployees() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const employees = await this.employeeRepo.find({
      where: { service: In(this.servicesAutorises) },
      order: { nomPrenom: 'ASC' },
    });

    const pointagesJour = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :today', { today })
      .getMany();

    const matriculesPresents = new Set(pointagesJour.map((p) => p.matricule));
    const statutsActifs = await this.statutManuelService.findActifsPourDate(today);

    const presents: PresenceEmployee[] = [];
    const absents: PresenceEmployee[] = [];
    const enConge: PresenceEmployee[] = []; // ✅ NOUVEAU

    for (const e of employees) {
      const matriculeNum = parseInt(e.matricule, 10);
      const manuel = statutsActifs.get(e.matricule);

      if (!isNaN(matriculeNum) && matriculesPresents.has(matriculeNum)) {
        const entree = pointagesJour.find(
          (p) => p.matricule === matriculeNum && p.ingressoUscita === '0100',
        );
        const sortie = pointagesJour.find(
          (p) => p.matricule === matriculeNum && p.ingressoUscita === '0000',
        );
        const pointage = entree || sortie;

        presents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          heureEntree: entree?.dataOra || null,
          heureSortie: sortie?.dataOra || null,
          timbratrice: pointage?.timbratrice || null,
          statut: 'present',
          commentaire: null,
        });
      } else if (estStatutPresentManuel(manuel?.statut)) {
        // ✅ présent manuel (présent saisi manuellement OU badge oublié)
        presents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          heureEntree: null,
          heureSortie: null,
          timbratrice: null,
          statut: 'present',
          commentaire: manuel?.commentaire || null,
        });
      } else if (estStatutJustifie(manuel?.statut)) {
        // ✅ NOUVEAU — en congé / justifié
        enConge.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          statut: manuel!.statut as StatutPresence,
          commentaire: manuel?.commentaire || null,
        });
      } else {
        absents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          statut: (manuel?.statut as StatutPresence) || 'absent',
          commentaire: manuel?.commentaire || null,
        });
      }
    }

    return {
      totalEmployes: employees.length,
      totalPresents: presents.length,
      totalAbsents: absents.length,
      totalEnConge: enConge.length, // ✅ NOUVEAU
      presents,
      absents,
      enConge, // ✅ NOUVEAU
    };
  }

  // ════════════════════════════════════════════════════════════════
  // Présents/Absents par période, basé sur Employee (4 services)
  // ════════════════════════════════════════════════════════════════
  async getPresenceParPeriodeEmployees(dateDebut: string, dateFin: string) {
    const debut = new Date(dateDebut);
    debut.setHours(0, 0, 0, 0);

    const fin = new Date(dateFin);
    fin.setHours(23, 59, 59, 999);

    const employees = await this.employeeRepo.find({
      where: { service: In(this.servicesAutorises) },
      order: { nomPrenom: 'ASC' },
    });

    const pointagesPeriode = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :debut', { debut })
      .andWhere('p.dataOra <= :fin', { fin })
      .andWhere('p.ingressoUscita = :entree', { entree: '0100' })
      .getMany();

    const matriculesPresents = new Set(pointagesPeriode.map((p) => p.matricule));
    const statutsActifs = await this.statutManuelService.findActifsPourPeriode(debut, fin);

    const presents: PresenceEmployee[] = [];
    const absents: PresenceEmployee[] = [];
    const enConge: PresenceEmployee[] = []; // ✅ NOUVEAU

    for (const e of employees) {
      const matriculeNum = parseInt(e.matricule, 10);
      const manuel = statutsActifs.get(e.matricule);

      if (!isNaN(matriculeNum) && matriculesPresents.has(matriculeNum)) {
        const pointage = pointagesPeriode.find((p) => p.matricule === matriculeNum);
        presents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          heureEntree: pointage?.dataOra,
          timbratrice: pointage?.timbratrice,
          statut: 'present',
          commentaire: null,
        });
      } else if (estStatutPresentManuel(manuel?.statut)) {
        presents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          heureEntree: null,
          timbratrice: null,
          statut: 'present',
          commentaire: manuel?.commentaire || null,
        });
      } else if (estStatutJustifie(manuel?.statut)) {
        // ✅ NOUVEAU
        enConge.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          statut: manuel!.statut as StatutPresence,
          commentaire: manuel?.commentaire || null,
        });
      } else {
        absents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          statut: (manuel?.statut as StatutPresence) || 'absent',
          commentaire: manuel?.commentaire || null,
        });
      }
    }

    return {
      dateDebut,
      dateFin,
      totalEmployes: employees.length,
      totalPresents: presents.length,
      totalAbsents: absents.length,
      totalEnConge: enConge.length, // ✅ NOUVEAU
      presents,
      absents,
      enConge, // ✅ NOUVEAU
    };
  }

  // ════════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — Récap jours Présent/Absent/Congé sur une période,
  // pour Ouvriers ET Employees, en se basant uniquement sur les
  // données réelles (pointage physique + table des statuts manuels).
  // ════════════════════════════════════════════════════════════════
  async getRecapJoursPeriode(dateDebut: string, dateFin: string) {
    // ── Liste des jours (yyyy-MM-dd) — calcul par chaîne pure ───────
    const jours: string[] = this.genererJoursPeriode(dateDebut, dateFin);

    const bornesParJour = jours.map(jour => {
      const debutJour = new Date(jour);
      debutJour.setHours(0, 0, 0, 0);
      const finJour = new Date(jour);
      finJour.setHours(23, 59, 59, 999);
      return { jour, debutJour, finJour };
    });

    const debutPeriode = bornesParJour[0].debutJour;
    const finPeriode = bornesParJour[bornesParJour.length - 1].finJour;

    // ── Pointages "entrée" sur toute la période ──────────────────
    const pointagesPeriode = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :debut', { debut: debutPeriode })
      .andWhere('p.dataOra <= :fin', { fin: finPeriode })
      .andWhere('p.ingressoUscita = :entree', { entree: '0100' })
      .getMany();

    const joursPresentsParMatricule = new Map<number, Set<string>>();
    pointagesPeriode.forEach((p) => {
      const jourTrouve = bornesParJour.find(
        (b) => p.dataOra >= b.debutJour && p.dataOra <= b.finJour,
      );
      if (!jourTrouve) return;
      if (!joursPresentsParMatricule.has(p.matricule)) {
        joursPresentsParMatricule.set(p.matricule, new Set());
      }
      joursPresentsParMatricule.get(p.matricule)!.add(jourTrouve.jour);
    });

    // ── Statuts manuels qui chevauchent la période (liste complète) ──
    const statutsManuels = await this.statutManuelService.findAllActifsPourPeriode(
      debutPeriode,
      finPeriode,
    );
    const statutsParMatricule = new Map<string, StatutManuel[]>();
    statutsManuels.forEach((s) => {
      if (!statutsParMatricule.has(s.matricule)) statutsParMatricule.set(s.matricule, []);
      statutsParMatricule.get(s.matricule)!.push(s);
    });

    const statutPourJour = (matriculeStr: string, jour: string): TypeStatutManuel | null => {
      const liste = statutsParMatricule.get(matriculeStr);
      if (!liste) return null;
      const found = liste.find((s) => s.dateDebut <= jour && s.dateFin >= jour);
      return found ? found.statut : null;
    };

    const calculerRecap = (matriculeNum: number, matriculeStr: string) => {
      let joursPresent = 0;
      let joursAbsent = 0;
      let joursConge = 0;
      const datesAbsence: string[] = []; // ✅ NOUVEAU
      const joursPresentsSet = joursPresentsParMatricule.get(matriculeNum);

      for (const jour of jours) {
        if (joursPresentsSet?.has(jour)) {
          joursPresent++;
          continue;
        }
        const statut = statutPourJour(matriculeStr, jour);
        if (estStatutPresentManuel(statut)) {
          // présent (saisi manuellement) ou badge oublié
          joursPresent++;
        } else if (statut) {
          // conge / maladie / mission / absence_non_justifiee / autre → regroupés en "Congé"
          joursConge++;
        } else {
          joursAbsent++;
          datesAbsence.push(jour); // ✅ NOUVEAU — on retient la date
        }
      }
      return { joursPresent, joursAbsent, joursConge, datesAbsence };
    };

    // ── Ouvriers ───────────────────────────────────────────────────
    const tousOuvriers = await this.ouvrierRepo.find();
    const recapOuvriers: RecapPersonneJours[] = tousOuvriers.map((o) => ({
      matricule: o.matricule,
      nomPrenom: o.nomPrenom,
      ...calculerRecap(o.matricule, String(o.matricule)),
    }));

    // ── Employees (4 services) ──────────────────────────────────────
    const employees = await this.employeeRepo.find({
      where: { service: In(this.servicesAutorises) },
      order: { nomPrenom: 'ASC' },
    });
    const recapEmployees: RecapPersonneJours[] = employees.map((e) => {
      const matriculeNum = parseInt(e.matricule, 10);
      return {
        matricule: e.matricule,
        nomPrenom: e.nomPrenom,
        service: e.service,
        ...calculerRecap(matriculeNum, e.matricule),
      };
    });

    return {
      dateDebut,
      dateFin,
      recapOuvriers,
      recapEmployees,
    };
  }
 private genererJoursPeriode(dateDebut: string, dateFin: string): string[] {
    const jours: string[] = [];
    let cursor = dateDebut;
    while (cursor <= dateFin) {
      jours.push(cursor);
      cursor = this.lendemain(cursor);
    }
    return jours;
  }

  private lendemain(jour: string): string {
    const [y, m, d] = jour.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + 1);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
   async getRecapPosteAujourdhui(): Promise<RecapPoste[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const affectations = await this.affectationRepo.find({ relations: ['ouvrier'] });

    const pointagesJour = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :today', { today })
      .getMany();

    const matriculesPresents = new Set(pointagesJour.map((p) => p.matricule));
    const statutsActifs = await this.statutManuelService.findActifsPourDate(today);

    return this.aggregerParPosteLigne(affectations, pointagesJour, matriculesPresents, statutsActifs);
  }

  // ─── Sur une période ────────────────────────────────────────────
  async getRecapPostePeriode(dateDebut: string, dateFin: string): Promise<RecapPoste[]> {
    const debut = new Date(dateDebut);
    debut.setHours(0, 0, 0, 0);

    const fin = new Date(dateFin);
    fin.setHours(23, 59, 59, 999);

    const affectations = await this.affectationRepo.find({ relations: ['ouvrier'] });

    const pointagesPeriode = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :debut', { debut })
      .andWhere('p.dataOra <= :fin', { fin })
      .andWhere('p.ingressoUscita = :entree', { entree: '0100' })
      .getMany();

    const matriculesPresents = new Set(pointagesPeriode.map((p) => p.matricule));
    const statutsActifs = await this.statutManuelService.findActifsPourPeriode(debut, fin);

      return this.aggregerParPosteLigne(affectations, pointagesPeriode, matriculesPresents, statutsActifs);

  }

  // ─── Helper d'agrégation commun ─────────────────────────────────
 private aggregerParPosteLigne(
  affectations: Affectation[],
  pointages: Pointage[],
  matriculesPresents: Set<number>,
  statutsActifs: Map<string, any>,
): RecapPoste[] {
  const map = new Map<string, RecapPoste>();

  // Retrouve l'heure d'entrée + timbratrice pour chaque matricule
  const entreeParMatricule = new Map<number, Pointage>();
  pointages.forEach((p) => {
    if (p.ingressoUscita === '0100' && !entreeParMatricule.has(p.matricule)) {
      entreeParMatricule.set(p.matricule, p);
    }
  });

  for (const a of affectations) {
    if (!a.ouvrier) continue;

    const matricule = a.ouvrier.matricule;
    const key = `${a.ligne}__${a.poste}`;

    if (!map.has(key)) {
      map.set(key, {
        ligne: a.ligne,
        poste: a.poste,
        totalAffectes: 0,
        presents: 0,
        absents: 0,
        enConge: 0, // ✅ NOUVEAU
        presentsListe: [],
        absentsListe: [],
        enCongeListe: [], // ✅ NOUVEAU
      });
    }

    const entry = map.get(key)!;
    entry.totalAffectes++;

    const manuel = statutsActifs.get(String(matricule));
    const estPresentManuel = estStatutPresentManuel(manuel?.statut);
    const estPresent = matriculesPresents.has(matricule) || estPresentManuel;
    const estJustifie = !estPresent && estStatutJustifie(manuel?.statut);

    if (estPresent) {
      entry.presents++;
      const pointageEntree = entreeParMatricule.get(matricule);
      entry.presentsListe.push({
        matricule,
        nomPrenom: a.ouvrier.nomPrenom,
        heureEntree: pointageEntree?.dataOra || null,
        timbratrice: pointageEntree?.timbratrice || null,
        statut: 'present',
        commentaire: estPresentManuel ? (manuel?.commentaire || null) : null,
      });
    } else if (estJustifie) {
      // ✅ NOUVEAU — en congé / justifié
      entry.enConge++;
      entry.enCongeListe.push({
        matricule,
        nomPrenom: a.ouvrier.nomPrenom,
        heureEntree: null,
        timbratrice: null,
        statut: manuel!.statut as StatutPresence,
        commentaire: manuel?.commentaire || null,
      });
    } else {
      entry.absents++;
      entry.absentsListe.push({
        matricule,
        nomPrenom: a.ouvrier.nomPrenom,
        heureEntree: null,
        timbratrice: null,
        statut: (manuel?.statut || 'absent') as StatutPresence,
        commentaire: manuel?.commentaire || null,
      });
    }
  }

  return Array.from(map.values()).sort(
    (x, y) => x.ligne.localeCompare(y.ligne) || x.poste.localeCompare(y.poste),
  );
}
// ── Nouvelle méthode dans PointageService ──
private readonly SEUIL_ALERTE_DEFAUT = 80; // % — à rendre configurable par ligne plus tard

async getRecapPosteAujourdhuiDetaille(): Promise<LigneEffectifDetaille[]> {
  const recap = await this.getRecapPosteAujourdhui(); // réutilise l'agrégation existante

  return recap.map((r) => {
    const absencesParCategorie: Record<CategorieAbsence, number> = {
      conge: 0,
      maladie: 0,
      injustifiee: 0,
      autre: 0,
      sans_motif: 0,
    };

    const absentsListe = r.absentsListe.map((a) => {
      const categorie = categoriserAbsence(a.statut as TypeStatutManuel);
      absencesParCategorie[categorie]++;
      return { ...a, categorie };
    });

    const tauxCouverture = r.totalAffectes > 0
      ? Math.round((r.presents / r.totalAffectes) * 100)
      : 100;

    return {
      ligne: r.ligne,
      poste: r.poste,
      totalAffectes: r.totalAffectes,
      presents: r.presents,
      tauxCouverture,
      seuilAlerte: this.SEUIL_ALERTE_DEFAUT,
      enAlerte: tauxCouverture < this.SEUIL_ALERTE_DEFAUT,
      absencesParCategorie,
      presentsListe: r.presentsListe,
      absentsListe,
    };
  });
}
// ══════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — Dashboard statistiques RH (vue Direction Générale)
  // ══════════════════════════════════════════════════════════════
 async getStatsDashboard(dateDebut: string, dateFin: string, service?: string) {
    const jours = this.genererJoursPeriode(dateDebut, dateFin);

    const bornesParJour = jours.map(jour => {
      const debutJour = new Date(jour);
      debutJour.setHours(0, 0, 0, 0);
      const finJour = new Date(jour);
      finJour.setHours(23, 59, 59, 999);
      return { jour, debutJour, finJour };
    });

    const debutPeriode = bornesParJour[0].debutJour;
    const finPeriode = bornesParJour[bornesParJour.length - 1].finJour;

    const pointagesPeriode = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :debut', { debut: debutPeriode })
      .andWhere('p.dataOra <= :fin', { fin: finPeriode })
      .andWhere('p.ingressoUscita = :entree', { entree: '0100' })
      .getMany();

    const joursPresentsParMatricule = new Map<number, Set<string>>();
    pointagesPeriode.forEach((p) => {
      const jourTrouve = bornesParJour.find(
        (b) => p.dataOra >= b.debutJour && p.dataOra <= b.finJour,
      );
      if (!jourTrouve) return;
      if (!joursPresentsParMatricule.has(p.matricule)) {
        joursPresentsParMatricule.set(p.matricule, new Set());
      }
      joursPresentsParMatricule.get(p.matricule)!.add(jourTrouve.jour);
    });

    const statutsManuels = await this.statutManuelService.findAllActifsPourPeriode(
      debutPeriode,
      finPeriode,
    );
    const statutsParMatricule = new Map<string, StatutManuel[]>();
    statutsManuels.forEach((s) => {
      if (!statutsParMatricule.has(s.matricule)) statutsParMatricule.set(s.matricule, []);
      statutsParMatricule.get(s.matricule)!.push(s);
    });

    // ✅ retourne le statut COMPLET (pas juste le libellé) pour pouvoir
    // sous-classer la maladie (accouchement / courte / longue durée)
    const statutRecordPourJour = (matriculeStr: string, jour: string): StatutManuel | null => {
      const liste = statutsParMatricule.get(matriculeStr);
      if (!liste) return null;
      const found = liste.find((s) => s.dateDebut <= jour && s.dateFin >= jour);
      return found || null;
    };

    // ── Population suivie : Ouvriers + Employees (4 services) ────
    const tousOuvriers = await this.ouvrierRepo.find();
    const employees = await this.employeeRepo.find({
      where: { service: In(this.servicesAutorises) },
    });

    let population = [
      ...tousOuvriers.map((o) => ({
        matriculeNum: o.matricule,
        matriculeStr: String(o.matricule),
        nomPrenom: o.nomPrenom,
        groupe: 'Ouvriers',
      })),
      ...employees.map((e) => ({
        matriculeNum: parseInt(e.matricule, 10),
        matriculeStr: e.matricule,
        nomPrenom: e.nomPrenom,
        groupe: e.service,
      })),
    ];

    // ✅ NOUVEAU — filtre par bouton service (Tous / Administratif / .../ Ouvriers)
    if (service && service !== 'tous') {
      population = population.filter((p) => p.groupe === service);
    }

    // ── Compteurs ──────────────────────────────────────────────────
    const repartitionParType = new Map<string, number>();
    const repartitionParGroupe = new Map<
      string,
      { total: number; joursPresent: number; joursAbsent: number }
    >();
    const recurrenceNonJustifiee = new Map<
      string,
      { matricule: string; nomPrenom: string; groupe: string; occurrences: number }
    >();

    let totalJoursPresent = 0;
    let totalJoursAbsent = 0;
    let absencesNonJustifiees = 0; // ✅ uniquement le statut explicite saisi par le RH
    let joursSansStatut = 0;        // ✅ NOUVEAU — aucune saisie RH, catégorie distincte
    let joursCongePoses = 0;
    const personnesEnConge = new Set<string>();
    let enAttenteJustification = 0;
    const absentsParJour = new Map<string, number>();
    jours.forEach((j) => absentsParJour.set(j, 0));

    for (const p of population) {
      if (!repartitionParGroupe.has(p.groupe)) {
        repartitionParGroupe.set(p.groupe, { total: 0, joursPresent: 0, joursAbsent: 0 });
      }
      const grp = repartitionParGroupe.get(p.groupe)!;
      grp.total++;

      const joursPresentsSet = joursPresentsParMatricule.get(p.matriculeNum);

      for (const jour of jours) {
        const presentBadge = joursPresentsSet?.has(jour) ?? false;
        const statutRecord = statutRecordPourJour(p.matriculeStr, jour);
        const presentManuel = estStatutPresentManuel(statutRecord?.statut as TypeStatutManuel);

        if (presentBadge || presentManuel) {
          totalJoursPresent++;
          grp.joursPresent++;
          continue;
        }

        // ── Journée d'absence : on classe par type ──────────────
        totalJoursAbsent++;
        grp.joursAbsent++;
        absentsParJour.set(jour, (absentsParJour.get(jour) || 0) + 1);

        let type: string;
        if (!statutRecord) {
          // ✅ Aucun statut saisi par le RH → "Non renseigné", PAS "Absence non justifiée"
          type = 'sans_statut';
          joursSansStatut++;
        } else if (statutRecord.statut === 'maladie') {
          // ✅ NOUVEAU — sous-classement de la maladie
          type = this.classifierMaladie(statutRecord);
        } else {
          type = statutRecord.statut;
        }

        repartitionParType.set(type, (repartitionParType.get(type) || 0) + 1);

        if (statutRecord?.statut === 'absence_non_justifiee') {
          // ✅ Ne compte QUE si le RH a explicitement saisi ce statut
          absencesNonJustifiees++;
          const key = p.matriculeStr;
          if (!recurrenceNonJustifiee.has(key)) {
            recurrenceNonJustifiee.set(key, {
              matricule: p.matriculeStr,
              nomPrenom: p.nomPrenom,
              groupe: p.groupe,
              occurrences: 0,
            });
          }
          recurrenceNonJustifiee.get(key)!.occurrences++;
        } else if (statutRecord?.statut === 'conge') {
          joursCongePoses++;
          personnesEnConge.add(p.matriculeStr);
        } else if (statutRecord?.statut === 'attente_justification') {
          enAttenteJustification++;
        }
      }
    }

    const effectifSuivi = population.length;
    const totalJoursTheoriques = effectifSuivi * jours.length;
    const tauxAbsenteisme =
      totalJoursTheoriques > 0
        ? Math.round((totalJoursAbsent / totalJoursTheoriques) * 1000) / 10
        : 0;

    const labels: Record<string, string> = {
      sans_statut: 'Non renseigné (à traiter)',
      absence_non_justifiee: 'Absence non justifiée',
      conge: 'Congé',
      maladie_courte_duree: 'Maladie (courte durée)',
      maladie_longue_duree: 'Maladie (longue durée >10j)',
      maladie_accouchement: 'Maladie (accouchement)',
      mission: 'Mission',
      raison_familiale: 'Raison familiale',
      fin_contrat: 'Fin de contrat',
      mise_a_pied: 'Mise à pied',
      attente_justification: 'En attente de justification',
      autre: 'Autre',
    };

    return {
      periode: { dateDebut, dateFin, nbJours: jours.length },
      kpis: {
        effectifSuivi,
        tauxAbsenteisme,
        totalJoursAbsent,
        absencesNonJustifiees,
        joursSansStatut, // ✅ NOUVEAU
        joursCongePoses,
        personnesEnConge: personnesEnConge.size,
        enAttenteJustification,
      },
      tendance: jours.map((jour) => ({
        jour,
        tauxAbsence:
          effectifSuivi > 0
            ? Math.round(((absentsParJour.get(jour) || 0) / effectifSuivi) * 1000) / 10
            : 0,
      })),
      repartitionParType: Array.from(repartitionParType.entries())
        .map(([statut, count]) => ({ statut, label: labels[statut] || statut, count }))
        .sort((a, b) => b.count - a.count),
      repartitionParGroupe: Array.from(repartitionParGroupe.entries()).map(
        ([groupe, v]) => ({
          groupe,
          total: v.total,
          tauxAbsence:
            v.total > 0
              ? Math.round((v.joursAbsent / (v.total * jours.length)) * 1000) / 10
              : 0,
        }),
      ),
      recurrences: Array.from(recurrenceNonJustifiee.values())
        .filter((r) => r.occurrences >= 2)
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 10),
    };
  }
  async getFichePersonne(matricule: string, dateDebut: string, dateFin: string) {
    const jours = this.genererJoursPeriode(dateDebut, dateFin);
    const bornesParJour = jours.map((jour) => {
      const debutJour = new Date(jour);
      debutJour.setHours(0, 0, 0, 0);
      const finJour = new Date(jour);
      finJour.setHours(23, 59, 59, 999);
      return { jour, debutJour, finJour };
    });
    const debutPeriode = bornesParJour[0].debutJour;
    const finPeriode = bornesParJour[bornesParJour.length - 1].finJour;

    // ── Identifie la personne : Ouvrier (matricule numérique) ou Employee ──
    const matriculeNum = parseInt(matricule, 10);
    let nomPrenom = '';
    let groupe = '';

    const ouvrier = !isNaN(matriculeNum)
      ? await this.ouvrierRepo.findOne({ where: { matricule: matriculeNum } })
      : null;

    let matriculeStr: string;
    let matriculePointage: number;

    if (ouvrier) {
      nomPrenom = ouvrier.nomPrenom;
      groupe = 'Ouvriers';
      matriculeStr = String(ouvrier.matricule);
      matriculePointage = ouvrier.matricule;
    } else {
      const employee = await this.employeeRepo.findOne({ where: { matricule } });
      if (!employee) {
        throw new NotFoundException(`Aucune personne trouvée pour le matricule ${matricule}`);
      }
      nomPrenom = employee.nomPrenom;
      groupe = employee.service;
      matriculeStr = employee.matricule;
      matriculePointage = parseInt(employee.matricule, 10);
    }

    // ── Pointages "entrée" de la personne sur la période ──────────
    const pointagesPeriode = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.matricule = :matricule', { matricule: matriculePointage })
      .andWhere('p.dataOra >= :debut', { debut: debutPeriode })
      .andWhere('p.dataOra <= :fin', { fin: finPeriode })
      .andWhere('p.ingressoUscita = :entree', { entree: '0100' })
      .getMany();

    const joursPresentsSet = new Set<string>();
    pointagesPeriode.forEach((p) => {
      const jourTrouve = bornesParJour.find(
        (b) => p.dataOra >= b.debutJour && p.dataOra <= b.finJour,
      );
      if (jourTrouve) joursPresentsSet.add(jourTrouve.jour);
    });

    // ── Statuts manuels de la personne sur la période ─────────────
    const tousLesStatuts = await this.statutManuelService.findAllActifsPourPeriode(
      debutPeriode,
      finPeriode,
    );
    const statutsPersonne = tousLesStatuts.filter((s) => s.matricule === matriculeStr);

    const statutPourJour = (jour: string): string | null => {
      const found = statutsPersonne.find((s) => s.dateDebut <= jour && s.dateFin >= jour);
      return found ? found.statut : null;
    };

    const timeline = jours.map((jour) => {
      const presentBadge = joursPresentsSet.has(jour);
      const statut = statutPourJour(jour);
      const presentManuel = estStatutPresentManuel(statut as TypeStatutManuel);

      let etat: string;
      if (presentBadge || presentManuel) etat = 'present';
      else if (statut) etat = statut;
      else etat = 'absence_non_justifiee';

      return { jour, etat };
    });

    let joursPresent = 0;
    let joursAbsentNonJustifie = 0;
    let joursJustifies = 0;
    timeline.forEach((t) => {
      if (t.etat === 'present') joursPresent++;
      else if (t.etat === 'absence_non_justifiee') joursAbsentNonJustifie++;
      else joursJustifies++;
    });

    return {
      matricule: matriculeStr,
      nomPrenom,
      groupe,
      periode: { dateDebut, dateFin },
      resume: {
        joursPresent,
        joursAbsentNonJustifie,
        joursJustifies,
        tauxPresence: jours.length > 0 ? Math.round((joursPresent / jours.length) * 100) : 0,
      },
      timeline,
    };
  }
   private classifierMaladie(s: StatutManuel): string {
    if (s.typeMaladie === 'accouchement') return 'maladie_accouchement';
    const [y1, m1, d1] = s.dateDebut.split('-').map(Number);
    const [y2, m2, d2] = s.dateFin.split('-').map(Number);
    const debut = Date.UTC(y1, m1 - 1, d1);
    const fin = Date.UTC(y2, m2 - 1, d2);
    const dureeJours = Math.round((fin - debut) / 86400000) + 1;
    return dureeJours > 10 ? 'maladie_longue_duree' : 'maladie_courte_duree';
  }

}