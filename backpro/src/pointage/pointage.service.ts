import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Pointage } from './entities/pointage.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Badge } from 'src/autosaisie/entities/badge.entity';
import { Employee } from '../employee/entities/employee.entity';
import { StatutManuelService } from '../statut-manuel/statut-manuel.service'; // ✅ NOUVEAU

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

    // ✅ NOUVEAU — statuts manuels actifs aujourd'hui
    const statutsActifs = await this.statutManuelService.findActifsPourDate(today);

    const presents = tousOuvriers
      .filter((o) => matriculesPresents.has(o.matricule))
      .map((o) => {
        const entree = pointagesJour.find(
          (p) => p.matricule === o.matricule && p.ingressoUscita === '0100',
        );
        const sortie = pointagesJour.find(
          (p) => p.matricule === o.matricule && p.ingressoUscita === '0000',
        );
        const pointage = entree || sortie;
        return {
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          heureEntree: entree?.dataOra || null,
          heureSortie: sortie?.dataOra || null,
          timbratrice: pointage?.timbratrice,
          statut: 'present' as StatutPresence,
        };
      });

    const absents = tousOuvriers
      .filter((o) => !matriculesPresents.has(o.matricule))
      .map((o) => {
        // ✅ NOUVEAU — fusion avec le statut manuel si présent
        const manuel = statutsActifs.get(String(o.matricule));
        return {
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          statut: (manuel?.statut || 'absent') as StatutPresence,
          commentaire: manuel?.commentaire || null,
        };
      });

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

    // ✅ NOUVEAU — statuts manuels qui chevauchent la période
    const statutsActifs = await this.statutManuelService.findActifsPourPeriode(debut, fin);

    const presents = tousOuvriers
      .filter((o) => matriculesPresents.has(o.matricule))
      .map((o) => {
        const pointage = pointagesPeriode.find((p) => p.matricule === o.matricule);
        return {
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          heureEntree: pointage?.dataOra,
          timbratrice: pointage?.timbratrice,
          statut: 'present' as StatutPresence,
        };
      });

    const absents = tousOuvriers
      .filter((o) => !matriculesPresents.has(o.matricule))
      .map((o) => {
        const manuel = statutsActifs.get(String(o.matricule));
        return {
          matricule: o.matricule,
          nomPrenom: o.nomPrenom,
          statut: (manuel?.statut || 'absent') as StatutPresence,
          commentaire: manuel?.commentaire || null,
        };
      });

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

    // ✅ NOUVEAU
    const statutsActifs = await this.statutManuelService.findActifsPourDate(today);

    const presents: PresenceEmployee[] = [];
    const absents: PresenceEmployee[] = [];

    for (const e of employees) {
      const matriculeNum = parseInt(e.matricule, 10);

      if (isNaN(matriculeNum)) {
        this.logger.warn(`⚠️ Matricule invalide pour ${e.nomPrenom}: "${e.matricule}"`);
        const manuel = statutsActifs.get(e.matricule);
        absents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          statut: manuel?.statut || 'absent',
          commentaire: manuel?.commentaire || null,
        });
        continue;
      }

      if (matriculesPresents.has(matriculeNum)) {
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
        });
      } else {
        // ✅ NOUVEAU — fusion statut manuel
        const manuel = statutsActifs.get(e.matricule);
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

    // ✅ NOUVEAU
    const statutsActifs = await this.statutManuelService.findActifsPourPeriode(debut, fin);

    const presents: PresenceEmployee[] = [];
    const absents: PresenceEmployee[] = [];

    for (const e of employees) {
      const matriculeNum = parseInt(e.matricule, 10);

      if (!isNaN(matriculeNum) && matriculesPresents.has(matriculeNum)) {
        const pointage = pointagesPeriode.find((p) => p.matricule === matriculeNum);
        presents.push({
          matricule: e.matricule,
          nomPrenom: e.nomPrenom,
          service: e.service,
          heureEntree: pointage?.dataOra,
          timbratrice: pointage?.timbratrice,
          statut: 'present',
        });
      } else {
        const manuel = statutsActifs.get(e.matricule);
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
}