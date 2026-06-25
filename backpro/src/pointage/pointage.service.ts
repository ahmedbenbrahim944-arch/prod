import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Pointage } from './entities/pointage.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Badge } from 'src/autosaisie/entities/badge.entity';
import { Employee } from '../employee/entities/employee.entity';
import { StatutManuelService } from '../statut-manuel/statut-manuel.service'; // ✅ NOUVEAU
import { TypeStatutManuel, StatutManuel } from 'src/statut-manuel/entites/statut-manuel.entity';

// ✅ Type étendu — inclut les statuts manuels
export type StatutPresence = 'present' | 'absent' | 'conge' | 'maladie' | 'mission' | 'autre';

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

// ✅ NOUVEAU — récap jours présent/absent/congé pour une personne sur une période
export interface RecapPersonneJours {
  matricule: string | number;
  nomPrenom: string;
  service?: string;
  joursPresent: number;
  joursAbsent: number;
  joursConge: number;
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
          matricule = badgeFound.matricule;
          nomPrenom = badgeFound.ouvrier.nomPrenom;
          this.logger.log(`✅ Badge ${row.badge} → matricule ${matricule} (${nomPrenom})`);
        } else {
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
      } else if (manuel?.statut === TypeStatutManuel.PRESENT) {
        // ✅ NOUVEAU — présent manuel (badge oublié), pas de pointage physique
        presents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          heureEntree: null,
          heureSortie: null,
          timbratrice: null,
          statut: 'present' as StatutPresence,
          commentaire: manuel.commentaire || null,
        });
      } else {
        // ── Absent (avec ou sans motif manuel : congé/maladie/...) ──
        absents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          statut: (manuel?.statut || 'absent') as StatutPresence,
          commentaire: manuel?.commentaire || null,
        });
      }
    }

    return {
      total: presents.length,
      presents,
      absents,
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
      } else if (manuel?.statut === TypeStatutManuel.PRESENT) {
        presents.push({
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          heureEntree: null,
          timbratrice: null,
          statut: 'present' as StatutPresence,
          commentaire: manuel.commentaire || null,
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
      total: presents.length,
      presents,
      absents,
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
      } else if (manuel?.statut === TypeStatutManuel.PRESENT) {
        // ✅ NOUVEAU — présent manuel (badge oublié)
        presents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          heureEntree: null,
          heureSortie: null,
          timbratrice: null,
          statut: 'present',
          commentaire: manuel.commentaire || null,
        });
      } else {
        absents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          statut: manuel?.statut || 'absent',
          commentaire: manuel?.commentaire || null,
        });
      }
    }

    return {
      totalEmployes: employees.length,
      totalPresents: presents.length,
      totalAbsents: absents.length,
      presents,
      absents,
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
      } else if (manuel?.statut === TypeStatutManuel.PRESENT) {
        presents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          heureEntree: null,
          timbratrice: null,
          statut: 'present',
          commentaire: manuel.commentaire || null,
        });
      } else {
        absents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          statut: manuel?.statut || 'absent',
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
      presents,
      absents,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // ✅ NOUVEAU — Récap jours Présent/Absent/Congé sur une période,
  // pour Ouvriers ET Employees, en se basant uniquement sur les
  // données réelles (pointage physique + table des statuts manuels).
  // ════════════════════════════════════════════════════════════════
  async getRecapJoursPeriode(dateDebut: string, dateFin: string) {
    const debut = new Date(dateDebut);
    debut.setHours(0, 0, 0, 0);

    const fin = new Date(dateFin);
    fin.setHours(23, 59, 59, 999);

    // ── Liste des jours (yyyy-MM-dd) de la période ────────────────
    const jours: string[] = [];
    const cursor = new Date(debut);
    while (cursor <= fin) {
      jours.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    // ── Pointages "entrée" sur la période → Map<matricule, Set<jour>> ──
    const pointagesPeriode = await this.pointageRepo
      .createQueryBuilder('p')
      .where('p.dataOra >= :debut', { debut })
      .andWhere('p.dataOra <= :fin', { fin })
      .andWhere('p.ingressoUscita = :entree', { entree: '0100' })
      .getMany();

    const joursPresentsParMatricule = new Map<number, Set<string>>();
    pointagesPeriode.forEach((p) => {
      const jour = p.dataOra.toISOString().split('T')[0];
      if (!joursPresentsParMatricule.has(p.matricule)) {
        joursPresentsParMatricule.set(p.matricule, new Set());
      }
      joursPresentsParMatricule.get(p.matricule)!.add(jour);
    });

    // ── Statuts manuels qui chevauchent la période (liste complète) ──
    const statutsManuels = await this.statutManuelService.findAllActifsPourPeriode(debut, fin);
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
      const joursPresentsSet = joursPresentsParMatricule.get(matriculeNum);

      for (const jour of jours) {
        if (joursPresentsSet?.has(jour)) {
          joursPresent++;
          continue;
        }
        const statut = statutPourJour(matriculeStr, jour);
        if (statut === TypeStatutManuel.PRESENT) {
          joursPresent++;
        } else if (statut) {
          // conge / maladie / mission / autre → regroupés en "Congé"
          joursConge++;
        } else {
          joursAbsent++;
        }
      }
      return { joursPresent, joursAbsent, joursConge };
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
}