import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Planification } from '../semaine/entities/planification.entity';
import { NonConformite } from '../non-conf/entities/non-conf.entity';
import { SaisieRapport } from '../saisie-rapport/entities/saisie-rapport.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { GetStatsDateDto } from './dto/get-stats-date.dto';
import { Semaine } from '../semaine/entities/semaine.entity';
import { MoreThanOrEqual, LessThanOrEqual, Between, In } from 'typeorm';
import { GetStats5MDateDto } from './dto/get-stats-5m-date.dto';
import { StatutOuvrier } from 'src/statut/entities/statut-ouvrier.entity';
import { GetStatsPeriodeDto } from './dto/get-stats-periode.dto';
import { PlanningSelection } from 'src/planning-selection/entities/planning-selection.entity';
import { GetStatsSelectionDto } from './dto/get-stats-selection.dto';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    @InjectRepository(NonConformite)
    private nonConfRepository: Repository<NonConformite>,
    @InjectRepository(SaisieRapport)
    private saisieRapportRepository: Repository<SaisieRapport>,
    @InjectRepository(Ouvrier)
    private ouvrierRepository: Repository<Ouvrier>,
    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,
    @InjectRepository(StatutOuvrier)
    private statutOuvrierRepository: Repository<StatutOuvrier>,
    @InjectRepository(PlanningSelection)
    private planningSelectionRepository: Repository<PlanningSelection>,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private getQuantitySource(plan: Planification): number {
    return plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee;
  }

  private calculerPourcentage5M(valeurM: number, qtePlanifiee: number): number {
    if (qtePlanifiee <= 0) return 0;
    return Math.round((valeurM / qtePlanifiee) * 100 * 10) / 10;
  }

  private calculerEcartPourcentage(total5M: number, quantiteSource: number): number {
    if (quantiteSource <= 0) return 0;
    return Math.round((total5M / quantiteSource) * 100 * 10) / 10;
  }

  /**
   * ✅ NOUVEAU — Construit la condition WHERE pour le poste.
   * Si poste est undefined → pas de filtre (les 2 postes agrégés).
   * Si poste = 'poste1' ou 'poste2' → filtre strict.
   */
 

  /**
   * ✅ NOUVEAU — Applique le filtre poste sur un QueryBuilder (TypeORM).
   */
  private applyPosteToQB(
    qb: any,
    poste?: string,
    alias = 'plan'
  ): void {
    if (poste) {
      qb.andWhere(`${alias}.poste = :poste`, { poste });
    }
  }

  /**
   * ✅ NOUVEAU — Libellé lisible du poste pour les réponses API.
   */
  private libellePoste(poste?: string): string {
    if (poste === 'poste1') return 'Poste 1 (6h-14h)';
    if (poste === 'poste2') return 'Poste 2 (14h-22h)';
    return 'Tous postes (poste1 + poste2)';
  }

  // ─── getStatsBySemaineAndLigne ───────────────────────────────────────────────

  async getStatsBySemaineAndLigne(semaine: string, ligne: string, poste?: string) {
    console.log(`=== STATS ${ligne} - ${semaine} | poste=${poste ?? 'tous'} ===`);

    const planifications = await this.planificationRepository.find({
      where: { semaine, ligne, ...this.buildPosteWhere(poste) },
      relations: ['nonConformites'],
      order: { jour: 'ASC', reference: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la ligne ${ligne}, semaine ${semaine}${poste ? `, ${poste}` : ''}`
      );
    }

    let totalQtePlanifiee = 0, totalQteModifiee = 0, totalQteSource = 0;
    let totalDecProduction = 0, totalDeltaProd = 0;
    let totalEcart = 0, totalEcartMatierePremiere = 0, totalEcartAbsence = 0;
    let totalEcartRendement = 0, totalEcartMethode = 0, totalEcartMaintenance = 0;
    let totalEcartQualite = 0, totalEcartEnvironnement = 0;

    const statsParReference: Record<string, any> = {};
    const referencesUniques = new Set<string>();

    for (const plan of planifications) {
      const quantiteSource = this.getQuantitySource(plan);
      totalQtePlanifiee += plan.qtePlanifiee;
      totalQteModifiee  += plan.qteModifiee;
      totalQteSource    += quantiteSource;
      totalDecProduction += plan.decProduction;
      totalDeltaProd    += plan.deltaProd;

      if (!statsParReference[plan.reference]) {
        statsParReference[plan.reference] = {
          reference: plan.reference,
          totalQtePlanifiee: 0, totalQteModifiee: 0,
          totalQteSource: 0, totalDecProduction: 0, totalEcart: 0,
          detailsParJour: {}, nonConformites: []
        };
      }

      const refStats = statsParReference[plan.reference];
      refStats.totalQtePlanifiee  += plan.qtePlanifiee;
      refStats.totalQteModifiee   += plan.qteModifiee;
      refStats.totalQteSource     += quantiteSource;
      refStats.totalDecProduction += plan.decProduction;

      if (!refStats.detailsParJour[plan.jour]) {
        refStats.detailsParJour[plan.jour] = {
          qtePlanifiee: 0, qteModifiee: 0, qteSource: 0,
          decProduction: 0, pcsProd: 0, ecart: 0, ecartPourcentage: 0
        };
      }

      const jourStats = refStats.detailsParJour[plan.jour];
      jourStats.qtePlanifiee  += plan.qtePlanifiee;
      jourStats.qteModifiee   += plan.qteModifiee;
      jourStats.qteSource     += quantiteSource;
      jourStats.decProduction += plan.decProduction;
      jourStats.pcsProd = jourStats.qteSource > 0
        ? (jourStats.decProduction / jourStats.qteSource) * 100 : 0;

      if (plan.nonConformites?.length > 0) {
        const nonConf = plan.nonConformites[0];
        totalEcart                += nonConf.total;
        totalEcartMatierePremiere += nonConf.matierePremiere;
        totalEcartAbsence         += nonConf.absence;
        totalEcartRendement       += nonConf.rendement;
        totalEcartMethode         += nonConf.methode;
        totalEcartMaintenance     += nonConf.maintenance;
        totalEcartQualite         += nonConf.qualite;
        totalEcartEnvironnement   += nonConf.environnement;

        refStats.totalEcart  += nonConf.total;
        jourStats.ecart      += nonConf.total;
        jourStats.ecartPourcentage = this.calculerEcartPourcentage(
          jourStats.ecart, jourStats.qteSource
        );

        refStats.nonConformites.push({
          jour: plan.jour,
          matierePremiere: nonConf.matierePremiere,
          referenceMatierePremiere: nonConf.referenceMatierePremiere,
          absence: nonConf.absence,
          rendement: nonConf.rendement,
          methode: nonConf.methode,
          maintenance: nonConf.maintenance,
          qualite: nonConf.qualite,
          environnement: nonConf.environnement,
          total: nonConf.total,
          ecartPourcentage: nonConf.ecartPourcentage ||
            this.calculerEcartPourcentage(nonConf.total, quantiteSource),
          commentaire: nonConf.commentaire
        });
      }
      referencesUniques.add(plan.reference);
    }

    const pcsProdTotal         = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;
    const pcsProdTotalArrondi  = Math.round(pcsProdTotal * 100) / 100;
    const pourcentageTotalEcart = totalQteSource > 0 ? (totalEcart / totalQteSource) * 100 : 0;

    const repartitionEcartParCause = {
      matierePremiere : { quantite: totalEcartMatierePremiere, pourcentage: this.calculerPourcentage5M(totalEcartMatierePremiere, totalQteSource) },
      absence         : { quantite: totalEcartAbsence,         pourcentage: this.calculerPourcentage5M(totalEcartAbsence,         totalQteSource) },
      rendement       : { quantite: totalEcartRendement,       pourcentage: this.calculerPourcentage5M(totalEcartRendement,       totalQteSource) },
      methode         : { quantite: totalEcartMethode,         pourcentage: this.calculerPourcentage5M(totalEcartMethode,         totalQteSource) },
      maintenance     : { quantite: totalEcartMaintenance,     pourcentage: this.calculerPourcentage5M(totalEcartMaintenance,     totalQteSource) },
      qualite         : { quantite: totalEcartQualite,         pourcentage: this.calculerPourcentage5M(totalEcartQualite,         totalQteSource) },
      environnement   : { quantite: totalEcartEnvironnement,   pourcentage: this.calculerPourcentage5M(totalEcartEnvironnement,   totalQteSource) },
    };

    const statsParReferenceFormate = Object.values(statsParReference).map((ref: any) => {
      const pcsProdRef         = ref.totalQteSource > 0 ? (ref.totalDecProduction / ref.totalQteSource) * 100 : 0;
      const pourcentageEcartRef = ref.totalQteSource > 0 ? (ref.totalEcart / ref.totalQteSource) * 100 : 0;
      return {
        reference: ref.reference,
        totalQtePlanifiee: ref.totalQtePlanifiee,
        totalQteModifiee: ref.totalQteModifiee,
        totalQteSource: ref.totalQteSource,
        totalDecProduction: ref.totalDecProduction,
        pcsProd: Math.round(pcsProdRef * 100) / 100,
        totalEcart: ref.totalEcart,
        pourcentageEcart: Math.round(pourcentageEcartRef * 10) / 10,
        detailsParJour: Object.entries(ref.detailsParJour).map(([jour, data]: [string, any]) => ({
          jour,
          qtePlanifiee: data.qtePlanifiee,
          qteModifiee: data.qteModifiee,
          qteSource: data.qteSource,
          decProduction: data.decProduction,
          pcsProd: Math.round(data.pcsProd * 100) / 100,
          ecart: data.ecart,
          ecartPourcentage: Math.round(data.ecartPourcentage * 10) / 10
        })),
        nonConformites: ref.nonConformites
      };
    });

    return {
      message: `Statistiques pour la ligne ${ligne} - Semaine ${semaine}`,
      periode: {
        semaine, ligne,
        poste: this.libellePoste(poste), // ✅ NOUVEAU
        dateCalcul: new Date().toISOString()
      },
      resumeGeneral: {
        nombrePlanifications: planifications.length,
        nombreReferences: referencesUniques.size,
        totalQtePlanifiee, totalQteModifiee, totalQteSource, totalDecProduction,
        deltaProdTotal: totalDeltaProd,
        pcsProdTotal: Math.round(pcsProdTotal * 100) / 100,
        pcsProdTotalPourcentage: `${pcsProdTotalArrondi}%`,
        totalEcart,
        pourcentageTotalEcart: Math.round(pourcentageTotalEcart * 10) / 10
      },
      repartitionEcartParCause,
      statsParReference: statsParReferenceFormate,
      details: planifications.map(plan => ({
        id: plan.id,
        jour: plan.jour,
        poste: plan.poste, // ✅ NOUVEAU
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: this.getQuantitySource(plan),
        decProduction: plan.decProduction,
        deltaProd: plan.deltaProd,
        pcsProd: `${plan.pcsProd}%`,
        nbOperateurs: plan.nbOperateurs,
        nbHeuresPlanifiees: plan.nbHeuresPlanifiees
      }))
    };
  }

  // ─── getPcsProdTotalParLigne ─────────────────────────────────────────────────

  async getPcsProdTotalParLigne(semaine: string, poste?: string) {
    console.log(`=== PCS PAR LIGNE ${semaine} | poste=${poste ?? 'tous'} ===`);

    const planifications = await this.planificationRepository.find({
      where: { semaine, ...this.buildPosteWhere(poste) },
      relations: ['nonConformites'],
      order: { ligne: 'ASC', jour: 'ASC', reference: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(`Aucune planification pour la semaine ${semaine}${poste ? `, ${poste}` : ''}`);
    }

    const statsParLigne: Record<string, any> = {};

    for (const plan of planifications) {
      const quantiteSource = this.getQuantitySource(plan);
      const ligne = plan.ligne;

      if (!statsParLigne[ligne]) {
        statsParLigne[ligne] = {
          ligne, totalQteSource: 0, totalDecProduction: 0,
          nombreReferences: new Set<string>(), nombrePlanifications: 0,
          detailsParReference: {}
        };
      }
      const ligneStats = statsParLigne[ligne];
      ligneStats.totalQteSource     += quantiteSource;
      ligneStats.totalDecProduction += plan.decProduction;
      ligneStats.nombrePlanifications++;
      ligneStats.nombreReferences.add(plan.reference);

      if (!ligneStats.detailsParReference[plan.reference]) {
        ligneStats.detailsParReference[plan.reference] = { totalQteSource: 0, totalDecProduction: 0 };
      }
      ligneStats.detailsParReference[plan.reference].totalQteSource     += quantiteSource;
      ligneStats.detailsParReference[plan.reference].totalDecProduction += plan.decProduction;
    }

    const resultat = Object.values(statsParLigne).map((ligne: any) => {
      const pcsProdTotal = ligne.totalQteSource > 0
        ? (ligne.totalDecProduction / ligne.totalQteSource) * 100 : 0;
      return {
        ligne: ligne.ligne,
        nombrePlanifications: ligne.nombrePlanifications,
        nombreReferences: ligne.nombreReferences.size,
        totalQteSource: ligne.totalQteSource,
        totalDecProduction: ligne.totalDecProduction,
        pcsProdTotal: Math.round(pcsProdTotal * 100) / 100,
        references: Object.entries(ligne.detailsParReference).map(([ref, data]: [string, any]) => ({
          reference: ref,
          pcsProd: data.totalQteSource > 0
            ? Math.round((data.totalDecProduction / data.totalQteSource) * 10000) / 100 : 0
        }))
      };
    });

    const totalSemaineQteSource     = resultat.reduce((s, l) => s + l.totalQteSource, 0);
    const totalSemaineDecProduction = resultat.reduce((s, l) => s + l.totalDecProduction, 0);
    const pcsTotalSemaine = totalSemaineQteSource > 0
      ? Math.round((totalSemaineDecProduction / totalSemaineQteSource) * 100 * 100) / 100 : 0;

    resultat.sort((a, b) => a.ligne.localeCompare(b.ligne));

    return {
      message: `PCS Prod Total par ligne - Semaine ${semaine}`,
      semaine,
      poste: this.libellePoste(poste), // ✅ NOUVEAU
      dateCalcul: new Date().toISOString(),
      nombreLignes: resultat.length,
      resumeGlobalSemaine: {
        totalQteSource: totalSemaineQteSource,
        totalDecProduction: totalSemaineDecProduction,
        pcsTotalSemaine,
        pcsTotalSemainePourcentage: `${pcsTotalSemaine}%`
      },
      lignes: resultat
    };
  }

  // ─── getStatsPourcentage5MParSemaine ─────────────────────────────────────────

  async getStatsPourcentage5MParSemaine(semaine: string, poste?: string) {
    console.log(`=== 5M PAR SEMAINE ${semaine} | poste=${poste ?? 'tous'} ===`);
    try {
      const planifications = await this.planificationRepository.find({
        where: { semaine, ...this.buildPosteWhere(poste) },
        relations: ['nonConformites']
      });

      if (planifications.length === 0) {
        throw new NotFoundException(`Aucune planification pour la semaine ${semaine}${poste ? `, ${poste}` : ''}`);
      }

      let totalQuantiteSource = 0;
      let totalMatierePremiere = 0, totalAbsence = 0, totalRendement = 0;
      let totalMethode = 0, totalMaintenance = 0, totalQualite = 0;
      let totalEnvironnement = 0, total5M = 0;

      for (const plan of planifications) {
        totalQuantiteSource += this.getQuantitySource(plan);
        if (plan.nonConformites?.length > 0) {
          const nc = plan.nonConformites[0];
          totalMatierePremiere += nc.matierePremiere;
          totalAbsence         += nc.absence;
          totalRendement       += nc.rendement;
          totalMethode         += nc.methode;
          totalMaintenance     += nc.maintenance;
          totalQualite         += nc.qualite;
          totalEnvironnement   += nc.environnement;
          total5M              += nc.total;
        }
      }

      const cp = (v: number) => {
        if (totalQuantiteSource <= 0) return 0;
        return Math.round((v / totalQuantiteSource) * 100 * 10) / 10;
      };
      const cp5M = (v: number) => {
        if (total5M <= 0) return 0;
        return Math.round((v / total5M) * 100 * 10) / 10;
      };

      return {
        message: `Pourcentages 5M - Semaine ${semaine}`,
        periode: {
          semaine,
          poste: this.libellePoste(poste), // ✅ NOUVEAU
          dateCalcul: new Date().toISOString(),
          nombrePlanifications: planifications.length
        },
        resume: {
          totalQuantiteSource, total5M,
          pourcentageTotal5M: `${cp(total5M)}%`,
          pourcentageTotal5MNumber: cp(total5M)
        },
        pourcentagesParCause: {
          matierePremiere : { total: totalMatierePremiere, pourcentage: `${cp(totalMatierePremiere)}%`, pourcentageNumber: cp(totalMatierePremiere), pourcentageDansTotal5M: `${cp5M(totalMatierePremiere)}%`, pourcentageDansTotal5MNumber: cp5M(totalMatierePremiere) },
          absence         : { total: totalAbsence,         pourcentage: `${cp(totalAbsence)}%`,         pourcentageNumber: cp(totalAbsence),         pourcentageDansTotal5M: `${cp5M(totalAbsence)}%`,         pourcentageDansTotal5MNumber: cp5M(totalAbsence)         },
          rendement       : { total: totalRendement,       pourcentage: `${cp(totalRendement)}%`,       pourcentageNumber: cp(totalRendement),       pourcentageDansTotal5M: `${cp5M(totalRendement)}%`,       pourcentageDansTotal5MNumber: cp5M(totalRendement)       },
          methode         : { total: totalMethode,         pourcentage: `${cp(totalMethode)}%`,         pourcentageNumber: cp(totalMethode),         pourcentageDansTotal5M: `${cp5M(totalMethode)}%`,         pourcentageDansTotal5MNumber: cp5M(totalMethode)         },
          maintenance     : { total: totalMaintenance,     pourcentage: `${cp(totalMaintenance)}%`,     pourcentageNumber: cp(totalMaintenance),     pourcentageDansTotal5M: `${cp5M(totalMaintenance)}%`,     pourcentageDansTotal5MNumber: cp5M(totalMaintenance)     },
          qualite         : { total: totalQualite,         pourcentage: `${cp(totalQualite)}%`,         pourcentageNumber: cp(totalQualite),         pourcentageDansTotal5M: `${cp5M(totalQualite)}%`,         pourcentageDansTotal5MNumber: cp5M(totalQualite)         },
          environnement   : { total: totalEnvironnement,   pourcentage: `${cp(totalEnvironnement)}%`,   pourcentageNumber: cp(totalEnvironnement),   pourcentageDansTotal5M: `${cp5M(totalEnvironnement)}%`,   pourcentageDansTotal5MNumber: cp5M(totalEnvironnement)   },
        },
        resumeTableau: [
          { cause: 'Matière Première', total: totalMatierePremiere, pourcentage: cp(totalMatierePremiere), pourcentageDans5M: cp5M(totalMatierePremiere) },
          { cause: 'Absence',          total: totalAbsence,         pourcentage: cp(totalAbsence),         pourcentageDans5M: cp5M(totalAbsence)         },
          { cause: 'Rendement',        total: totalRendement,       pourcentage: cp(totalRendement),       pourcentageDans5M: cp5M(totalRendement)       },
          { cause: 'Méthode',          total: totalMethode,         pourcentage: cp(totalMethode),         pourcentageDans5M: cp5M(totalMethode)         },
          { cause: 'Maintenance',      total: totalMaintenance,     pourcentage: cp(totalMaintenance),     pourcentageDans5M: cp5M(totalMaintenance)     },
          { cause: 'Qualité',          total: totalQualite,         pourcentage: cp(totalQualite),         pourcentageDans5M: cp5M(totalQualite)         },
          { cause: 'Environnement',    total: totalEnvironnement,   pourcentage: cp(totalEnvironnement),   pourcentageDans5M: cp5M(totalEnvironnement)   },
        ]
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Erreur calcul 5M: ${error.message}`);
    }
  }

  // ─── getPourcentage5MParLigne ─────────────────────────────────────────────────

  async getPourcentage5MParLigne(semaine: string, poste?: string) {
    console.log(`=== 5M PAR LIGNE ${semaine} | poste=${poste ?? 'tous'} ===`);
    try {
      const planifications = await this.planificationRepository.find({
        where: { semaine, ...this.buildPosteWhere(poste) },
        relations: ['nonConformites'],
        order: { ligne: 'ASC' }
      });

      if (planifications.length === 0) {
        throw new NotFoundException(`Aucune planification pour la semaine ${semaine}${poste ? `, ${poste}` : ''}`);
      }

      const statsParLigne: Record<string, any> = {};

      for (const plan of planifications) {
        const ligne = plan.ligne;
        if (!statsParLigne[ligne]) {
          statsParLigne[ligne] = {
            ligne, totalQteSource: 0,
            matierePremiere: 0, absence: 0, rendement: 0, methode: 0,
            maintenance: 0, qualite: 0, environnement: 0, total5M: 0,
            nombrePlanifications: 0, references: new Set<string>()
          };
        }
        const ls = statsParLigne[ligne];
        ls.totalQteSource += this.getQuantitySource(plan);
        ls.nombrePlanifications++;
        ls.references.add(plan.reference);
        if (plan.nonConformites?.length > 0) {
          const nc = plan.nonConformites[0];
          ls.matierePremiere += nc.matierePremiere;
          ls.absence         += nc.absence;
          ls.rendement       += nc.rendement;
          ls.methode         += nc.methode;
          ls.maintenance     += nc.maintenance;
          ls.qualite         += nc.qualite;
          ls.environnement   += nc.environnement;
          ls.total5M         += nc.total;
        }
      }

      const cp  = (v: number, total: number) => total <= 0 ? 0 : Math.round((v / total) * 100 * 10) / 10;
      const cp5 = (v: number, t5: number)    => t5   <= 0 ? 0 : Math.round((v / t5)    * 100 * 10) / 10;

      const resultats = Object.values(statsParLigne).map((ls: any) => ({
        ligne: ls.ligne,
        nombrePlanifications: ls.nombrePlanifications,
        nombreReferences: ls.references.size,
        totalQteSource: ls.totalQteSource,
        total5M: ls.total5M,
        pourcentage5M: cp(ls.total5M, ls.totalQteSource),
        detailParCause: {
          matierePremiere : { quantite: ls.matierePremiere, pourcentage: cp5(ls.matierePremiere, ls.total5M), pourcentageDuTotal: cp(ls.matierePremiere, ls.totalQteSource) },
          absence         : { quantite: ls.absence,         pourcentage: cp5(ls.absence,         ls.total5M), pourcentageDuTotal: cp(ls.absence,         ls.totalQteSource) },
          rendement       : { quantite: ls.rendement,       pourcentage: cp5(ls.rendement,       ls.total5M), pourcentageDuTotal: cp(ls.rendement,       ls.totalQteSource) },
          methode         : { quantite: ls.methode,         pourcentage: cp5(ls.methode,         ls.total5M), pourcentageDuTotal: cp(ls.methode,         ls.totalQteSource) },
          maintenance     : { quantite: ls.maintenance,     pourcentage: cp5(ls.maintenance,     ls.total5M), pourcentageDuTotal: cp(ls.maintenance,     ls.totalQteSource) },
          qualite         : { quantite: ls.qualite,         pourcentage: cp5(ls.qualite,         ls.total5M), pourcentageDuTotal: cp(ls.qualite,         ls.totalQteSource) },
          environnement   : { quantite: ls.environnement,   pourcentage: cp5(ls.environnement,   ls.total5M), pourcentageDuTotal: cp(ls.environnement,   ls.totalQteSource) },
        },
        resumeTableau: [
          { cause: 'Matière Première', quantite: ls.matierePremiere, pourcentage5M: cp5(ls.matierePremiere, ls.total5M) },
          { cause: 'Absence',          quantite: ls.absence,         pourcentage5M: cp5(ls.absence,         ls.total5M) },
          { cause: 'Rendement',        quantite: ls.rendement,       pourcentage5M: cp5(ls.rendement,       ls.total5M) },
          { cause: 'Méthode',          quantite: ls.methode,         pourcentage5M: cp5(ls.methode,         ls.total5M) },
          { cause: 'Maintenance',      quantite: ls.maintenance,     pourcentage5M: cp5(ls.maintenance,     ls.total5M) },
          { cause: 'Qualité',          quantite: ls.qualite,         pourcentage5M: cp5(ls.qualite,         ls.total5M) },
          { cause: 'Environnement',    quantite: ls.environnement,   pourcentage5M: cp5(ls.environnement,   ls.total5M) },
        ]
      }));

      resultats.sort((a, b) => b.pourcentage5M - a.pourcentage5M);

      const totalGlobalQteSource = resultats.reduce((s, l) => s + l.totalQteSource, 0);
      const totalGlobal5M        = resultats.reduce((s, l) => s + l.total5M, 0);
      const pct5MGlobal          = cp(totalGlobal5M, totalGlobalQteSource);

      return {
        message: `Pourcentages 5M par ligne - Semaine ${semaine}`,
        periode: {
          semaine,
          poste: this.libellePoste(poste), // ✅ NOUVEAU
          dateCalcul: new Date().toISOString(),
          nombreTotalPlanifications: planifications.length,
          nombreLignes: resultats.length
        },
        resumeGlobal: { totalQteSource: totalGlobalQteSource, total5M: totalGlobal5M, pourcentage5MGlobal: pct5MGlobal },
        lignes: resultats,
        resumePourGraphique: {
          labels: resultats.map(l => l.ligne),
          pourcentages: resultats.map(l => l.pourcentage5M),
          totaux: resultats.map(l => l.total5M)
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Erreur 5M par ligne: ${error.message}`);
    }
  }

  // ─── getStatsParDate ─────────────────────────────────────────────────────────

  async getStatsParDate(dto: GetStatsDateDto) {
    const { date, poste } = dto;
    console.log(`=== STATS DATE ${date} | poste=${poste ?? 'tous'} ===`);
    try {
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
      const statsProduction   = await this.getProductionParLigneDate(semaine, jour, poste);
      const statsRapports     = await this.getRapportsSaisieStats(semaine, jour);

      const totalQteSource    = statsProduction.totalQteSource;
      const totalDecProduction = statsProduction.totalDecProduction;
      const pcsTotalToutesLignes = totalQteSource > 0
        ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100 : 0;

      return {
        message: `Statistiques complètes pour le ${date}`,
        periode: {
          date, jour, semaine,
          poste: this.libellePoste(poste), // ✅ NOUVEAU
          dateCalcul: new Date().toISOString()
        },
        lignesActives: statsProduction.lignesActives,
        lignesNonActives: statsProduction.lignesNonActives,
        resumeProduction: {
          nombreLignes: statsProduction.nombreLignes,
          nombreLignesActives: statsProduction.nombreLignesActives,
          nombreLignesNonActives: statsProduction.nombreLignesNonActives,
          totalQteSource, totalDecProduction, pcsTotalToutesLignes,
          pcsProdMoyen: statsProduction.pcsProdMoyen,
          total5M: statsProduction.total5M,
          pourcentage5MMoyen: statsProduction.pourcentage5MMoyen
        },
        rapportsSaisie: statsRapports
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Erreur stats date ${date}: ${error.message}`);
    }
  }

  // ─── getProductionParLigneDate (private) ─────────────────────────────────────

  private async getProductionParLigneDate(semaine: string, jour: string, poste?: string) {
    const planifications = await this.planificationRepository.find({
      where: { semaine, jour, ...this.buildPosteWhere(poste) }, // ✅
      relations: ['nonConformites'],
      order: { ligne: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification pour le ${jour} de la semaine ${semaine}${poste ? `, ${poste}` : ''}`
      );
    }

    const statsParLigne: Record<string, any> = {};

    for (const plan of planifications) {
      const ligne = plan.ligne;
      const quantiteSource = this.getQuantitySource(plan);
      if (!statsParLigne[ligne]) {
        statsParLigne[ligne] = {
          ligne, totalQtePlanifiee: 0, totalQteSource: 0,
          totalDecProduction: 0, total5M: 0,
          nombreReferences: new Set<string>(), nombrePlanifications: 0, references: []
        };
      }
      const ls = statsParLigne[ligne];
      ls.totalQtePlanifiee  += plan.qtePlanifiee;
      ls.totalQteSource     += quantiteSource;
      ls.totalDecProduction += plan.decProduction;
      ls.nombrePlanifications++;
      ls.nombreReferences.add(plan.reference);
      ls.references.push({
        reference: plan.reference, of: plan.of,
        qtePlanifiee: plan.qtePlanifiee, qteModifiee: plan.qteModifiee,
        qteSource: quantiteSource, decProduction: plan.decProduction,
        pcsProd: plan.pcsProd,
        poste: plan.poste // ✅ NOUVEAU : visible dans les détails
      });
      if (plan.nonConformites?.length > 0) ls.total5M += plan.nonConformites[0].total;
    }

    const lignesActives: any[] = [];
    const lignesNonActives: any[] = [];

    Object.values(statsParLigne).forEach((ls: any) => {
      const pcsProd     = ls.totalQteSource > 0 ? (ls.totalDecProduction / ls.totalQteSource) * 100 : 0;
      const pct5M       = ls.totalQteSource > 0 ? (ls.total5M / ls.totalQteSource) * 100 : 0;
      const ligneFormat = {
        ligne: ls.ligne,
        actif: ls.totalQtePlanifiee > 0,
        totalQtePlanifiee: ls.totalQtePlanifiee,
        nombrePlanifications: ls.nombrePlanifications,
        nombreReferences: ls.nombreReferences.size,
        totalQteSource: ls.totalQteSource,
        totalDecProduction: ls.totalDecProduction,
        pcsProdTotal: Math.round(pcsProd * 100) / 100,
        total5M: ls.total5M,
        pourcentage5M: Math.round(pct5M * 10) / 10,
        references: ls.references
      };
      ls.totalQtePlanifiee > 0 ? lignesActives.push(ligneFormat) : lignesNonActives.push(ligneFormat);
    });

    const toutesLignes       = [...lignesActives, ...lignesNonActives];
    const totalQteSource     = toutesLignes.reduce((s, l) => s + l.totalQteSource, 0);
    const totalDecProduction  = toutesLignes.reduce((s, l) => s + l.totalDecProduction, 0);
    const total5M            = toutesLignes.reduce((s, l) => s + l.total5M, 0);
    const pcsProdMoyen       = totalQteSource > 0 ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100 : 0;
    const pourcentage5MMoyen = totalQteSource > 0 ? Math.round((total5M / totalQteSource) * 100 * 10) / 10 : 0;

    return {
      nombreLignes: toutesLignes.length,
      nombreLignesActives: lignesActives.length,
      nombreLignesNonActives: lignesNonActives.length,
      totalQteSource, totalDecProduction, pcsProdMoyen, total5M, pourcentage5MMoyen,
      lignesActives, lignesNonActives
    };
  }

  // ─── getRapportsSaisieParDate ─────────────────────────────────────────────────

  async getRapportsSaisieParDate(dto: GetStatsDateDto) {
    const { date } = dto;
    try {
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
      const statsRapports = await this.getRapportsSaisieStats(semaine, jour);
      return {
        message: `Statistiques de saisie pour le ${date}`,
        periode: { date, jour, semaine, dateCalcul: new Date().toISOString() },
        ...statsRapports
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Erreur rapports saisie: ${error.message}`);
    }
  }

  private async getRapportsSaisieStats(semaine: string, jour: string) {
    const rapports = await this.saisieRapportRepository.find({
      where: { semaine, jour }, order: { ligne: 'ASC', matricule: 'ASC' }
    });
    const totalOuvriers          = await this.ouvrierRepository.count();
    const matriculesAyantSaisi   = new Set(rapports.map(r => r.matricule));
    const nombreRapportsSaisis   = matriculesAyantSaisi.size;
    const tousLesOuvriers        = await this.ouvrierRepository.find({ order: { matricule: 'ASC' } });
    const ouvriersNonSaisis      = tousLesOuvriers
      .filter(o => !matriculesAyantSaisi.has(o.matricule))
      .map(o => ({ matricule: o.matricule, nomPrenom: o.nomPrenom }));
    const ouvriersAyantSaisi     = rapports.map(r => ({
      matricule: r.matricule, nomPrenom: r.nomPrenom,
      ligne: r.ligne, totalHeures: r.totalHeuresJour,
      nbPhases: r.nbPhasesJour, phases: r.phases
    }));
    const statsParLigne: Record<string, any> = {};
    rapports.forEach(r => {
      if (!statsParLigne[r.ligne]) statsParLigne[r.ligne] = { nombreOuvriers: 0, totalHeures: 0, ouvriers: [] };
      statsParLigne[r.ligne].nombreOuvriers++;
      statsParLigne[r.ligne].totalHeures += r.totalHeuresJour;
      statsParLigne[r.ligne].ouvriers.push({ matricule: r.matricule, nomPrenom: r.nomPrenom, heures: r.totalHeuresJour });
    });
    const tauxSaisie = totalOuvriers > 0
      ? Math.round((nombreRapportsSaisis / totalOuvriers) * 100 * 10) / 10 : 0;
    return {
      nombreRapportsSaisis, nombreTotalRapports: rapports.length,
      nombreOuvriersTotal: totalOuvriers, nombreOuvriersNonSaisis: ouvriersNonSaisis.length,
      tauxSaisie, ouvriersNonSaisis, ouvriersAyantSaisi, repartitionParLigne: statsParLigne
    };
  }

  // ─── getStatsPcsParMoisEtLigne ────────────────────────────────────────────────

  async getStatsPcsParMoisEtLigne(dto: { date: string; poste?: string }) {
    const { date, poste } = dto;
    console.log(`=== PCS PAR MOIS ${date} | poste=${poste ?? 'tous'} ===`);
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) throw new BadRequestException(`Date invalide: ${date}`);
      const annee = dateObj.getFullYear();

      const moisNoms = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      const debutAnnee = new Date(`${annee}-01-01`);
      const finAnnee   = new Date(`${annee}-12-31`);
      const semaines   = await this.semaineRepository.find({
        where: { dateDebut: MoreThanOrEqual(debutAnnee) && LessThanOrEqual(finAnnee) }
      });
      if (semaines.length === 0) throw new NotFoundException(`Aucune semaine pour l'année ${annee}`);

      const nomsSemaines = semaines.map(s => s.nom);
      const planifications = await this.planificationRepository.find({
        where: nomsSemaines.map(s => ({ semaine: s, ...this.buildPosteWhere(poste) })), // ✅
        order: { ligne: 'ASC', semaine: 'ASC' }
      });
      if (planifications.length === 0) throw new NotFoundException(`Aucune planification pour ${annee}${poste ? `, ${poste}` : ''}`);

      const semaineVsMois: Record<string, number> = {};
      semaines.forEach(s => {
        const d = s.dateDebut instanceof Date ? s.dateDebut : new Date(s.dateDebut);
        semaineVsMois[s.nom] = d.getMonth() + 1;
      });

      const statsParLigneEtMois: Record<string, Record<number, { totalQteSource: number; totalDecProduction: number }>> = {};

      planifications.forEach(plan => {
        const ligne   = plan.ligne;
        const moisNum = semaineVsMois[plan.semaine];
        if (!moisNum) return;
        if (!statsParLigneEtMois[ligne]) statsParLigneEtMois[ligne] = {};
        if (!statsParLigneEtMois[ligne][moisNum]) statsParLigneEtMois[ligne][moisNum] = { totalQteSource: 0, totalDecProduction: 0 };
        statsParLigneEtMois[ligne][moisNum].totalQteSource     += this.getQuantitySource(plan);
        statsParLigneEtMois[ligne][moisNum].totalDecProduction += plan.decProduction;
      });

      const lignesFormatees = Object.entries(statsParLigneEtMois).map(([ligne, moisData]) => {
        const moisStats: Record<string, any> = {};
        let totalAnnuelQteSource = 0, totalAnnuelDecProduction = 0;
        for (let m = 1; m <= 12; m++) {
          const data = moisData[m];
          if (data?.totalQteSource > 0) {
            moisStats[moisNoms[m-1]] = { pcsProd: Math.round((data.totalDecProduction/data.totalQteSource)*100*100)/100, totalQteSource: data.totalQteSource, totalDecProduction: data.totalDecProduction };
            totalAnnuelQteSource     += data.totalQteSource;
            totalAnnuelDecProduction += data.totalDecProduction;
          } else {
            moisStats[moisNoms[m-1]] = { pcsProd: 0, totalQteSource: 0, totalDecProduction: 0 };
          }
        }
        const moyenneAnnuelle = totalAnnuelQteSource > 0
          ? Math.round((totalAnnuelDecProduction/totalAnnuelQteSource)*100*100)/100 : 0;
        return { ligne, mois: moisStats, moyenneAnnuelle, totalAnnuelQteSource, totalAnnuelDecProduction };
      });

      lignesFormatees.sort((a, b) => a.ligne.localeCompare(b.ligne));

      const productiviteMensuelle: Record<string, number> = {};
      for (let m = 1; m <= 12; m++) {
        const nom = moisNoms[m-1];
        const tQte  = lignesFormatees.reduce((s, l) => s + l.mois[nom].totalQteSource,     0);
        const tProd = lignesFormatees.reduce((s, l) => s + l.mois[nom].totalDecProduction, 0);
        productiviteMensuelle[nom] = tQte > 0 ? Math.round((tProd/tQte)*100*100)/100 : 0;
      }
      const totalGlobalQte  = lignesFormatees.reduce((s, l) => s + l.totalAnnuelQteSource,     0);
      const totalGlobalProd = lignesFormatees.reduce((s, l) => s + l.totalAnnuelDecProduction, 0);
      const moyenneGlobale  = totalGlobalQte > 0 ? Math.round((totalGlobalProd/totalGlobalQte)*100*100)/100 : 0;

      return {
        message: `PCS par mois - Année ${annee}`,
        annee,
        poste: this.libellePoste(poste), // ✅ NOUVEAU
        dateCalcul: new Date().toISOString(),
        nombreLignes: lignesFormatees.length,
        productiviteMensuelle, moyenneAnnuelleGlobale: moyenneGlobale,
        lignes: lignesFormatees
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Erreur PCS par mois: ${error.message}`);
    }
  }

  // ─── getStats5MParMois ────────────────────────────────────────────────────────

  async getStats5MParMois(dto: { date: string; poste?: string }) {
    const { date, poste } = dto;
    console.log(`=== 5M PAR MOIS ${date} | poste=${poste ?? 'tous'} ===`);
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) throw new BadRequestException(`Date invalide: ${date}`);
      const annee = dateObj.getFullYear();

      const moisNoms = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      const semaines = await this.semaineRepository.find({
        where: { dateDebut: MoreThanOrEqual(new Date(`${annee}-01-01`)) && LessThanOrEqual(new Date(`${annee}-12-31`)) }
      });
      if (semaines.length === 0) throw new NotFoundException(`Aucune semaine pour ${annee}`);

      const nomsSemaines = semaines.map(s => s.nom);
      const planifications = await this.planificationRepository.find({
        where: nomsSemaines.map(s => ({ semaine: s, ...this.buildPosteWhere(poste) })), // ✅
        relations: ['nonConformites'],
        order: { semaine: 'ASC' }
      });
      if (planifications.length === 0) throw new NotFoundException(`Aucune planification pour ${annee}${poste ? `, ${poste}` : ''}`);

      const semaineVsMois: Record<string, number> = {};
      semaines.forEach(s => {
        const d = s.dateDebut instanceof Date ? s.dateDebut : new Date(s.dateDebut);
        semaineVsMois[s.nom] = d.getMonth() + 1;
      });

      const statsParMois: Record<number, any> = {};
      for (let m = 1; m <= 12; m++) {
        statsParMois[m] = { totalQteSource: 0, matierePremiere: 0, absence: 0, rendement: 0, methode: 0, maintenance: 0, qualite: 0, environnement: 0, total5M: 0 };
      }

      planifications.forEach(plan => {
        const moisNum = semaineVsMois[plan.semaine];
        if (!moisNum) return;
        statsParMois[moisNum].totalQteSource += this.getQuantitySource(plan);
        if (plan.nonConformites?.length > 0) {
          const nc = plan.nonConformites[0];
          statsParMois[moisNum].matierePremiere += nc.matierePremiere;
          statsParMois[moisNum].absence         += nc.absence;
          statsParMois[moisNum].rendement       += nc.rendement;
          statsParMois[moisNum].methode         += nc.methode;
          statsParMois[moisNum].maintenance     += nc.maintenance;
          statsParMois[moisNum].qualite         += nc.qualite;
          statsParMois[moisNum].environnement   += nc.environnement;
          statsParMois[moisNum].total5M         += nc.total;
        }
      });

      const moisFormates: Record<string, any> = {};
      let tAnnuelQte=0, tAnnuel5M=0, tAnnuelMP=0, tAnnuelAbs=0, tAnnuelRend=0, tAnnuelMeth=0, tAnnuelMaint=0, tAnnuelQual=0, tAnnuelEnv=0;

      for (let m = 1; m <= 12; m++) {
        const nom  = moisNoms[m-1];
        const data = statsParMois[m];
        const cp   = (v: number) => data.totalQteSource <= 0 ? 0 : Math.round((v/data.totalQteSource)*100*100)/100;
        moisFormates[nom] = {
          totalQteSource: data.totalQteSource, total5M: data.total5M,
          pourcentageTotal5M: cp(data.total5M),
          matierePremiere : { quantite: data.matierePremiere, pourcentage: cp(data.matierePremiere) },
          absence         : { quantite: data.absence,         pourcentage: cp(data.absence)         },
          rendement       : { quantite: data.rendement,       pourcentage: cp(data.rendement)       },
          methode         : { quantite: data.methode,         pourcentage: cp(data.methode)         },
          maintenance     : { quantite: data.maintenance,     pourcentage: cp(data.maintenance)     },
          qualite         : { quantite: data.qualite,         pourcentage: cp(data.qualite)         },
          environnement   : { quantite: data.environnement,   pourcentage: cp(data.environnement)   },
        };
        tAnnuelQte+=data.totalQteSource; tAnnuel5M+=data.total5M;
        tAnnuelMP+=data.matierePremiere; tAnnuelAbs+=data.absence; tAnnuelRend+=data.rendement;
        tAnnuelMeth+=data.methode; tAnnuelMaint+=data.maintenance; tAnnuelQual+=data.qualite; tAnnuelEnv+=data.environnement;
      }

      const cpa  = (v: number) => tAnnuelQte <= 0 ? 0 : Math.round((v/tAnnuelQte)*100*100)/100;
      const cpa5 = (v: number) => tAnnuel5M  <= 0 ? 0 : Math.round((v/tAnnuel5M)*100*100)/100;
      const moyennesAnnuelles = {
        totalQteSource: tAnnuelQte, total5M: tAnnuel5M,
        pourcentageTotal5M: cpa(tAnnuel5M),
        matierePremiere : { quantite: tAnnuelMP,   pourcentage: cpa(tAnnuelMP),   pourcentageDans5M: cpa5(tAnnuelMP)   },
        absence         : { quantite: tAnnuelAbs,  pourcentage: cpa(tAnnuelAbs),  pourcentageDans5M: cpa5(tAnnuelAbs)  },
        rendement       : { quantite: tAnnuelRend, pourcentage: cpa(tAnnuelRend), pourcentageDans5M: cpa5(tAnnuelRend) },
        methode         : { quantite: tAnnuelMeth, pourcentage: cpa(tAnnuelMeth), pourcentageDans5M: cpa5(tAnnuelMeth) },
        maintenance     : { quantite: tAnnuelMaint,pourcentage: cpa(tAnnuelMaint),pourcentageDans5M: cpa5(tAnnuelMaint)},
        qualite         : { quantite: tAnnuelQual, pourcentage: cpa(tAnnuelQual), pourcentageDans5M: cpa5(tAnnuelQual) },
        environnement   : { quantite: tAnnuelEnv,  pourcentage: cpa(tAnnuelEnv),  pourcentageDans5M: cpa5(tAnnuelEnv)  },
      };

      return {
        message: `Statistiques 5M par mois - Année ${annee}`,
        annee,
        poste: this.libellePoste(poste), // ✅ NOUVEAU
        dateCalcul: new Date().toISOString(),
        mois: moisFormates,
        moyennesAnnuelles,
        donneesGraphiques: {
          graphiqueCirculaire: {
            labels: ['Matière Première','Absence','Rendement','Méthode','Maintenance','Qualité','Environnement'],
            values: [cpa5(tAnnuelMP),cpa5(tAnnuelAbs),cpa5(tAnnuelRend),cpa5(tAnnuelMeth),cpa5(tAnnuelMaint),cpa5(tAnnuelQual),cpa5(tAnnuelEnv)]
          },
          graphiqueBarres: { labels: moisNoms, values: moisNoms.map(m => moisFormates[m].pourcentageTotal5M) }
        },
        tableauRecapitulatif: moisNoms.map(m => ({
          mois: m,
          matierePremiere: moisFormates[m].matierePremiere.pourcentage,
          absence:         moisFormates[m].absence.pourcentage,
          rendement:       moisFormates[m].rendement.pourcentage,
          methode:         moisFormates[m].methode.pourcentage,
          maintenance:     moisFormates[m].maintenance.pourcentage,
          qualite:         moisFormates[m].qualite.pourcentage,
          environnement:   moisFormates[m].environnement.pourcentage,
          total5M:         moisFormates[m].pourcentageTotal5M
        }))
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Erreur 5M par mois: ${error.message}`);
    }
  }

  // ─── getAffectationPersonnel ──────────────────────────────────────────────────

  async getAffectationPersonnel(semaine: string, poste?: string) {
    console.log(`=== AFFECTATION PERSONNEL ${semaine} | poste=${poste ?? 'tous'} ===`);
    try {
      // QueryBuilder — filtre poste conditionnel
      const qb = this.planificationRepository
        .createQueryBuilder('plan')
        .select('plan.ligne', 'ligne')
        .addSelect('plan.jour', 'jour')
        .addSelect('SUM(plan.nbOperateurs)', 'totalNbOperateurs')
        .where('plan.semaine = :semaine', { semaine });

      this.applyPosteToQB(qb, poste); // ✅

      const planificationsAgregees = await qb
        .groupBy('plan.ligne')
        .addGroupBy('plan.jour')
        .getRawMany();

      if (planificationsAgregees.length === 0) {
        throw new NotFoundException(`Aucune planification pour la semaine ${semaine}${poste ? `, ${poste}` : ''}`);
      }

      const planifMap = new Map<string, number>();
      planificationsAgregees.forEach(p => {
        planifMap.set(`${p.ligne}-${p.jour}`, Math.round((parseFloat(p.totalNbOperateurs) || 0) * 10) / 10);
      });

      const saisies = await this.saisieRapportRepository
        .createQueryBuilder('saisie')
        .select('saisie.ligne', 'ligne')
        .addSelect('saisie.jour', 'jour')
        .addSelect('COUNT(DISTINCT saisie.matricule)', 'nbOperateurs')
        .where('saisie.semaine = :semaine', { semaine })
        .groupBy('saisie.ligne')
        .addGroupBy('saisie.jour')
        .getRawMany();

      const saisiesMap = new Map<string, number>();
      saisies.forEach(s => saisiesMap.set(`${s.ligne}-${s.jour}`, parseInt(s.nbOperateurs)));

      const lignesUniques = new Set<string>(planificationsAgregees.map(p => p.ligne));
      const jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi'];
      const lignes: any[] = [];

      lignesUniques.forEach(ligne => {
        const joursData = jours.map(jour => {
          const key       = `${ligne}-${jour}`;
          const nbPlanifie = planifMap.get(key) || 0;
          const nbSaisi    = saisiesMap.get(key) || 0;
          const difference = nbSaisi - nbPlanifie;
          const statut     = difference === 0 ? 'CONFORME' : 'NON_CONFORME';
          const message    = difference === 0
            ? 'Bon'
            : difference > 0
              ? `Non-conformité : +${difference} opérateur${difference > 1 ? 's' : ''}`
              : `Non-conformité : ${difference} opérateur${Math.abs(difference) > 1 ? 's' : ''}`;
          return { jour, nbPlanifie, nbSaisi, difference, statut, message };
        });
        lignes.push({ ligne, jours: joursData });
      });

      let totalPlanifie = 0, totalSaisi = 0, nbNonConformites = 0;
      lignes.forEach(l => l.jours.forEach((j: any) => {
        totalPlanifie += j.nbPlanifie;
        totalSaisi    += j.nbSaisi;
        if (j.statut === 'NON_CONFORME') nbNonConformites++;
      }));
      const tauxConformite = totalPlanifie > 0
        ? Math.round(((totalPlanifie - Math.abs(totalSaisi - totalPlanifie)) / totalPlanifie) * 100 * 100) / 100 : 0;

      return {
        message: `Affectation personnel - Semaine ${semaine}`,
        semaine,
        poste: this.libellePoste(poste), // ✅ NOUVEAU
        dateCalcul: new Date().toISOString(),
        statistiquesGlobales: {
          totalPlanifie, totalSaisi, difference: totalSaisi - totalPlanifie,
          nbNonConformites, tauxConformite: `${tauxConformite}%`
        },
        lignes
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Erreur affectation personnel: ${error.message}`);
    }
  }

  // ─── getStats5MParDate ────────────────────────────────────────────────────────

  async getStats5MParDate(dto: GetStats5MDateDto) {
    const { date, poste } = dto;
    console.log(`=== 5M PAR DATE ${date} | poste=${poste ?? 'tous'} ===`);
    try {
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
      const planifications = await this.planificationRepository.find({
        where: { semaine, jour, ...this.buildPosteWhere(poste) }, // ✅
        relations: ['nonConformites'],
        order: { ligne: 'ASC', reference: 'ASC' }
      });

      if (planifications.length === 0) {
        throw new NotFoundException(
          `Aucune planification pour le ${jour} de la semaine ${semaine} (${date})${poste ? `, ${poste}` : ''}`
        );
      }

      const statsParLigne: Record<string, any> = {};

      for (const plan of planifications) {
        const ligne = plan.ligne;
        if (!statsParLigne[ligne]) {
          statsParLigne[ligne] = {
            ligne, totalQteSource: 0, total5M: 0,
            totalMatierePremiere: 0, totalAbsence: 0, totalRendement: 0,
            totalMethode: 0, totalMaintenance: 0, totalQualite: 0, totalEnvironnement: 0,
            references: []
          };
        }
        const ls = statsParLigne[ligne];
        const qteSource = this.getQuantitySource(plan);
        ls.totalQteSource += qteSource;

        const cp = (v: number) => qteSource <= 0 ? 0 : Math.round((v / qteSource) * 100 * 10) / 10;

        let ncData: any = null;
        if (plan.nonConformites?.length > 0) {
          const nc = plan.nonConformites[0];
          ls.total5M              += nc.total;
          ls.totalMatierePremiere += nc.matierePremiere;
          ls.totalAbsence         += nc.absence;
          ls.totalRendement       += nc.rendement;
          ls.totalMethode         += nc.methode;
          ls.totalMaintenance     += nc.maintenance;
          ls.totalQualite         += nc.qualite;
          ls.totalEnvironnement   += nc.environnement;
          ncData = {
            matierePremiere : { quantite: nc.matierePremiere, pourcentage: cp(nc.matierePremiere), reference: nc.referenceMatierePremiere || null },
            absence         : { quantite: nc.absence,         pourcentage: cp(nc.absence)         },
            rendement       : { quantite: nc.rendement,       pourcentage: cp(nc.rendement)       },
            methode         : { quantite: nc.methode,         pourcentage: cp(nc.methode)         },
            maintenance     : { quantite: nc.maintenance,     pourcentage: cp(nc.maintenance)     },
            qualite         : { quantite: nc.qualite,         pourcentage: cp(nc.qualite)         },
            environnement   : { quantite: nc.environnement,   pourcentage: cp(nc.environnement)   },
            total5M         : { quantite: nc.total,           pourcentage: cp(nc.total)           },
            commentaire: nc.commentaire || null
          };
        } else {
          ncData = {
            matierePremiere : { quantite: 0, pourcentage: 0, reference: null },
            absence         : { quantite: 0, pourcentage: 0 },
            rendement       : { quantite: 0, pourcentage: 0 },
            methode         : { quantite: 0, pourcentage: 0 },
            maintenance     : { quantite: 0, pourcentage: 0 },
            qualite         : { quantite: 0, pourcentage: 0 },
            environnement   : { quantite: 0, pourcentage: 0 },
            total5M         : { quantite: 0, pourcentage: 0 },
            commentaire: null
          };
        }

        ls.references.push({
          reference: plan.reference, of: plan.of,
          qtePlanifiee: plan.qtePlanifiee, qteModifiee: plan.qteModifiee,
          qteSource, decProduction: plan.decProduction, pcsProd: plan.pcsProd,
          poste: plan.poste, // ✅ NOUVEAU
          nonConformite: ncData
        });
      }

      const cpL  = (v: number, t: number) => t <= 0 ? 0 : Math.round((v/t)*100*10)/10;
      const cp5L = (v: number, t5: number) => t5 <= 0 ? 0 : Math.round((v/t5)*100*10)/10;

      const lignesFormatees = Object.values(statsParLigne).map((ls: any) => ({
        ligne: ls.ligne,
        nombreReferences: ls.references.length,
        totalQteSource: ls.totalQteSource,
        total5M: ls.total5M,
        pourcentage5M: cpL(ls.total5M, ls.totalQteSource),
        detailTotalParCause: {
          matierePremiere : { quantite: ls.totalMatierePremiere, pourcentageSource: cpL(ls.totalMatierePremiere, ls.totalQteSource), pourcentageDans5M: cp5L(ls.totalMatierePremiere, ls.total5M) },
          absence         : { quantite: ls.totalAbsence,         pourcentageSource: cpL(ls.totalAbsence,         ls.totalQteSource), pourcentageDans5M: cp5L(ls.totalAbsence,         ls.total5M) },
          rendement       : { quantite: ls.totalRendement,       pourcentageSource: cpL(ls.totalRendement,       ls.totalQteSource), pourcentageDans5M: cp5L(ls.totalRendement,       ls.total5M) },
          methode         : { quantite: ls.totalMethode,         pourcentageSource: cpL(ls.totalMethode,         ls.totalQteSource), pourcentageDans5M: cp5L(ls.totalMethode,         ls.total5M) },
          maintenance     : { quantite: ls.totalMaintenance,     pourcentageSource: cpL(ls.totalMaintenance,     ls.totalQteSource), pourcentageDans5M: cp5L(ls.totalMaintenance,     ls.total5M) },
          qualite         : { quantite: ls.totalQualite,         pourcentageSource: cpL(ls.totalQualite,         ls.totalQteSource), pourcentageDans5M: cp5L(ls.totalQualite,         ls.total5M) },
          environnement   : { quantite: ls.totalEnvironnement,   pourcentageSource: cpL(ls.totalEnvironnement,   ls.totalQteSource), pourcentageDans5M: cp5L(ls.totalEnvironnement,   ls.total5M) },
        },
        references: ls.references
      }));

      lignesFormatees.sort((a, b) => a.ligne.localeCompare(b.ligne));

      const tGlobalQte  = lignesFormatees.reduce((s, l) => s + l.totalQteSource, 0);
      const tGlobal5M   = lignesFormatees.reduce((s, l) => s + l.total5M, 0);
      const tGlobalMP   = Object.values(statsParLigne).reduce((s: number, l: any) => s + l.totalMatierePremiere, 0);
      const tGlobalAbs  = Object.values(statsParLigne).reduce((s: number, l: any) => s + l.totalAbsence,         0);
      const tGlobalRend = Object.values(statsParLigne).reduce((s: number, l: any) => s + l.totalRendement,       0);
      const tGlobalMeth = Object.values(statsParLigne).reduce((s: number, l: any) => s + l.totalMethode,         0);
      const tGlobalMaint= Object.values(statsParLigne).reduce((s: number, l: any) => s + l.totalMaintenance,     0);
      const tGlobalQual = Object.values(statsParLigne).reduce((s: number, l: any) => s + l.totalQualite,         0);
      const tGlobalEnv  = Object.values(statsParLigne).reduce((s: number, l: any) => s + l.totalEnvironnement,   0);
      const cpG  = (v: number) => tGlobalQte <= 0 ? 0 : Math.round((v/tGlobalQte)*100*10)/10;
      const cpG5 = (v: number) => tGlobal5M  <= 0 ? 0 : Math.round((v/tGlobal5M)*100*10)/10;

      return {
        message: `Statistiques 5M par ligne pour le ${date}`,
        periode: {
          date, jour, semaine,
          poste: this.libellePoste(poste), // ✅ NOUVEAU
          dateCalcul: new Date().toISOString()
        },
        resumeGlobal: { nombreLignes: lignesFormatees.length, nombreTotalReferences: planifications.length },
        resumeTotalJour: {
          totalQteSource: tGlobalQte, total5M: tGlobal5M, pourcentage5M: cpG(tGlobal5M),
          detailParCause: {
            matierePremiere : { quantite: tGlobalMP,   pourcentageSource: cpG(tGlobalMP),   pourcentageDans5M: cpG5(tGlobalMP)   },
            absence         : { quantite: tGlobalAbs,  pourcentageSource: cpG(tGlobalAbs),  pourcentageDans5M: cpG5(tGlobalAbs)  },
            rendement       : { quantite: tGlobalRend, pourcentageSource: cpG(tGlobalRend), pourcentageDans5M: cpG5(tGlobalRend) },
            methode         : { quantite: tGlobalMeth, pourcentageSource: cpG(tGlobalMeth), pourcentageDans5M: cpG5(tGlobalMeth) },
            maintenance     : { quantite: tGlobalMaint,pourcentageSource: cpG(tGlobalMaint),pourcentageDans5M: cpG5(tGlobalMaint)},
            qualite         : { quantite: tGlobalQual, pourcentageSource: cpG(tGlobalQual), pourcentageDans5M: cpG5(tGlobalQual) },
            environnement   : { quantite: tGlobalEnv,  pourcentageSource: cpG(tGlobalEnv),  pourcentageDans5M: cpG5(tGlobalEnv)  },
          }
        },
        lignes: lignesFormatees
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Erreur 5M par date: ${error.message}`);
    }
  }

  // ─── getProductiviteOuvriers ──────────────────────────────────────────────────

  async getProductiviteOuvriers(dateDebut: string, dateFin: string, poste?: string) {
    console.log(`=== PRODUCTIVITÉ OUVRIERS ${dateDebut}→${dateFin} | poste=${poste ?? 'tous'} ===`);
    try {
      const debut = new Date(dateDebut), fin = new Date(dateFin);
      if (isNaN(debut.getTime()) || isNaN(fin.getTime())) throw new BadRequestException('Format de date invalide');
      if (debut > fin) throw new BadRequestException('La date de début doit être avant la date de fin');

      const tousLesOuvriers = await this.ouvrierRepository.find({ order: { matricule: 'ASC' } });
      if (tousLesOuvriers.length === 0) throw new NotFoundException('Aucun ouvrier trouvé');

      const planningsSelection = await this.planningSelectionRepository.find({
        where: { date: Between(dateDebut, dateFin) },
        order: { date: 'ASC', matricule: 'ASC' }
      });

      const planningsMap = new Map<string, any>();
      planningsSelection.forEach(p => planningsMap.set(`${p.matricule}_${p.date}`, p));

      const datesPeriode = this.genererDatesEntre(debut, fin);
      const resultats: any[] = [];

      for (const ouvrier of tousLesOuvriers) {
        for (const dateObj of datesPeriode) {
          const dateStr = dateObj.toISOString().split('T')[0];
          const { semaine, jour } = this.convertirDateEnSemaineEtJour(dateStr);

          const planning = planningsMap.get(`${ouvrier.matricule}_${dateStr}`);
          if (planning) {
            // Filtre poste sur le planning de sélection
            if (poste && planning.poste && planning.poste !== poste) continue; // ✅
            resultats.push({
              JOURS: dateStr, MAT: ouvrier.matricule, 'NOM ET PRENOM': ouvrier.nomPrenom,
              'N°HEURS': planning.nHeures || 0, LIGNES: planning.ligne || 'selection',
              PRODUCTIVITE: planning.rendement || 0,
              M1:0, M2:0, M3:0, M4:0, M5:0, M6:0, M7:0,
              'PRODUCTIVITE MOYENNE': null, NOTE: '', _source: 'planning-selection'
            });
            continue;
          }

          const rapportsOuvrier = await this.saisieRapportRepository.find({
            where: { matricule: ouvrier.matricule, semaine, jour }
          });

          if (rapportsOuvrier.length > 0) {
            const rapport = rapportsOuvrier[0];
            const calculs = await this.calculerProductiviteEt7MPourOuvrier(
              ouvrier.matricule, semaine, jour, rapport.ligne, poste // ✅
            );
            resultats.push({
              JOURS: dateStr, MAT: ouvrier.matricule, 'NOM ET PRENOM': ouvrier.nomPrenom,
              'N°HEURS': rapport.totalHeuresJour, LIGNES: rapport.ligne,
              PRODUCTIVITE: calculs.productivite,
              M1: calculs.causes7M.matierePremiere, M2: calculs.causes7M.methode,
              M3: calculs.causes7M.maintenance,     M4: calculs.causes7M.qualite,
              M5: calculs.causes7M.absence,         M6: calculs.causes7M.rendement,
              M7: calculs.causes7M.environnement,
              'PRODUCTIVITE MOYENNE': null, NOTE: '', _source: 'rapports-saisie'
            });
          }
        }
      }

      resultats.sort((a, b) => a.JOURS < b.JOURS ? -1 : a.JOURS > b.JOURS ? 1 : a.MAT - b.MAT);

      const resultatsFinaux = resultats.map(({ _source, ...rest }) => rest);

      return {
        message: `Productivité ouvriers du ${dateDebut} au ${dateFin}`,
        periode: {
          dateDebut, dateFin,
          poste: this.libellePoste(poste), // ✅ NOUVEAU
          dateCalcul: new Date().toISOString()
        },
        statistiques: {
          periode: { dateDebut, dateFin, joursTotal: datesPeriode.length },
          resume: {
            nombreOuvriersTotal: tousLesOuvriers.length, nombreResultats: resultatsFinaux.length,
            parSource: {
              planningSelection: resultats.filter(r => r._source === 'planning-selection').length,
              rapportsSaisie:    resultats.filter(r => r._source === 'rapports-saisie').length
            }
          }
        },
        tableau: resultatsFinaux,
        donneesFormatees: {
          entetes: ['JOURS','MAT','NOM ET PRENOM','N°HEURS','LIGNES','PRODUCTIVITE','M1','M2','M3','M4','M5','M6','M7','PRODUCTIVITE MOYENNE','NOTE'],
          lignes: resultatsFinaux
        }
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Erreur productivité: ${error.message}`);
    }
  }

  // ─── getStatsParPeriode ───────────────────────────────────────────────────────

  async getStatsParPeriode(dateDebut: string, dateFin: string, poste?: string) {
    console.log(`=== STATS PÉRIODE ${dateDebut}→${dateFin} | poste=${poste ?? 'tous'} ===`);
    try {
      const debut = new Date(dateDebut), fin = new Date(dateFin);
      if (isNaN(debut.getTime()) || isNaN(fin.getTime())) throw new BadRequestException('Format de date invalide');
      if (debut > fin) throw new BadRequestException('La date de début doit être avant la date de fin');

      const estMemeDate = dateDebut === dateFin;
      const semaines = await this.getSemainesEntreDates(dateDebut, dateFin);
      if (semaines.length === 0) throw new NotFoundException(`Aucune semaine entre ${dateDebut} et ${dateFin}`);

      const [productionStats, personnelStats] = await Promise.all([
        this.calculerProductionEt7MPourPeriode(semaines, dateDebut, dateFin, estMemeDate, poste), // ✅
        this.calculerPersonnelPourPeriode(dateDebut, dateFin, estMemeDate)
      ]);

      const productionGlobale    = this.calculerProductionGlobale(productionStats.statsParLigne);
      const detailsNonConformites = await this.getDetailsNonConformitesPourPeriode(semaines, dateDebut, dateFin, estMemeDate, poste); // ✅

      return {
        message: estMemeDate
          ? `Statistiques complètes pour le ${dateDebut}`
          : `Statistiques complètes du ${dateDebut} au ${dateFin}`,
        periode: {
          dateDebut, dateFin,
          poste: this.libellePoste(poste), // ✅ NOUVEAU
          nombreSemaines: semaines.length,
          joursDansPeriode: personnelStats.joursDansPeriode,
          estJourUnique: estMemeDate,
          dateCalcul: new Date().toISOString()
        },
        productionGlobale: { ...productionGlobale, oee: null },
        statsParLigne: productionStats.statsParLigne,
        personnel: personnelStats,
        resume7M: productionStats.resume7M,
        detailsNonConformites
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Erreur stats période: ${error.message}`);
    }
  }

  // ─── Méthodes privées (production période + non-conformités) ─────────────────

  private async calculerProductionEt7MPourPeriode(
    semaines: string[], dateDebut: string, dateFin: string,
    estMemeDate: boolean = false, poste?: string // ✅
  ) {
    const planifications = await this.planificationRepository.find({
      where: semaines.map(s => ({ semaine: s, ...this.buildPosteWhere(poste) })), // ✅
      relations: ['nonConformites'],
      order: { ligne: 'ASC', semaine: 'ASC', jour: 'ASC' }
    });

    console.log(`Planifications initiales: ${planifications.length}`);

    const dateDebutObj = new Date(dateDebut), dateFinObj = new Date(dateFin);
    const filtered: Planification[] = [];

    for (const plan of planifications) {
      const datePlan = await this.getDateFromSemaineJour(plan.semaine, plan.jour);
      const datePlanObj = new Date(datePlan);
      if (estMemeDate) {
        if (datePlan === dateDebut) filtered.push(plan);
      } else {
        if (datePlanObj >= dateDebutObj && datePlanObj <= dateFinObj) filtered.push(plan);
      }
    }

    if (filtered.length === 0) {
      throw new NotFoundException(estMemeDate
        ? `Aucune planification pour le ${dateDebut}${poste ? `, ${poste}` : ''}`
        : `Aucune planification entre ${dateDebut} et ${dateFin}${poste ? `, ${poste}` : ''}`
      );
    }

    const statsParLigne: Record<string, any> = {};
    const totaux7MGlobaux = { matierePremiere:0, absence:0, rendement:0, methode:0, maintenance:0, qualite:0, environnement:0 };

    for (const plan of filtered) {
      const ligne = plan.ligne;
      const qs    = this.getQuantitySource(plan);
      if (!statsParLigne[ligne]) {
        statsParLigne[ligne] = {
          ligne, totalQteSource:0, totalDecProduction:0, totalQtePlanifiee:0,
          causes7M:{ matierePremiere:0, absence:0, rendement:0, methode:0, maintenance:0, qualite:0, environnement:0 },
          referencesMP:[], referencesQualite:[], references: new Set<string>(), detailsReferences:{}
        };
      }
      const ls = statsParLigne[ligne];
      ls.totalQteSource     += qs;
      ls.totalDecProduction += plan.decProduction;
      ls.totalQtePlanifiee  += plan.qtePlanifiee;
      ls.references.add(plan.reference);

      if (!ls.detailsReferences[plan.reference]) {
        ls.detailsReferences[plan.reference] = {
          reference: plan.reference, of: plan.of||'',
          qtePlanifiee:0, qteModifiee:0, decProduction:0, pcsProd: plan.pcsProd||0,
          poste: plan.poste, // ✅
          causes7M:{ matierePremiere:{quantite:0,reference:''}, absence:{quantite:0,reference:''}, rendement:{quantite:0,reference:''}, methode:{quantite:0,reference:''}, maintenance:{quantite:0,reference:''}, qualite:{quantite:0,reference:''}, environnement:{quantite:0,reference:''}, total:0, commentaire:'' }
        };
      }
      const rd = ls.detailsReferences[plan.reference];
      rd.qtePlanifiee += plan.qtePlanifiee;
      rd.qteModifiee  += plan.qteModifiee;
      rd.decProduction += plan.decProduction;

      if (plan.nonConformites?.length > 0) {
        const nc = plan.nonConformites[0];
        ls.causes7M.matierePremiere += nc.matierePremiere;
        ls.causes7M.absence         += nc.absence;
        ls.causes7M.rendement       += nc.rendement;
        ls.causes7M.methode         += nc.methode;
        ls.causes7M.maintenance     += nc.maintenance;
        ls.causes7M.qualite         += nc.qualite;
        ls.causes7M.environnement   += nc.environnement;
        rd.causes7M.matierePremiere.quantite += nc.matierePremiere;
        rd.causes7M.absence.quantite         += nc.absence;
        rd.causes7M.rendement.quantite       += nc.rendement;
        rd.causes7M.methode.quantite         += nc.methode;
        rd.causes7M.maintenance.quantite     += nc.maintenance;
        rd.causes7M.qualite.quantite         += nc.qualite;
        rd.causes7M.environnement.quantite   += nc.environnement;
        rd.causes7M.total += nc.total;
        if (nc.commentaire) rd.causes7M.commentaire = nc.commentaire;
        if (nc.referenceMatierePremiere?.trim() && nc.matierePremiere > 0) {
          const r = nc.referenceMatierePremiere.trim();
          if (!ls.referencesMP.includes(r)) ls.referencesMP.push(r);
          rd.causes7M.matierePremiere.reference = r;
        }
        if (nc.referenceQualite?.trim() && nc.qualite > 0) {
          const r = nc.referenceQualite.trim();
          if (!ls.referencesQualite.includes(r)) ls.referencesQualite.push(r);
          rd.causes7M.qualite.reference = r;
        }
        totaux7MGlobaux.matierePremiere += nc.matierePremiere;
        totaux7MGlobaux.absence         += nc.absence;
        totaux7MGlobaux.rendement       += nc.rendement;
        totaux7MGlobaux.methode         += nc.methode;
        totaux7MGlobaux.maintenance     += nc.maintenance;
        totaux7MGlobaux.qualite         += nc.qualite;
        totaux7MGlobaux.environnement   += nc.environnement;
      }
    }

    const cp = (v: number, t: number) => t <= 0 ? 0 : Math.round((v/t)*100*10)/10;

    const lignesFormatees = Object.values(statsParLigne).map((ls: any) => {
      const pcs = ls.totalQteSource > 0 ? (ls.totalDecProduction / ls.totalQteSource) * 100 : 0;
      const c   = (v: number) => cp(v, ls.totalQteSource);
      return {
        ligne: ls.ligne,
        nombreReferences: ls.references.size,
        production: { totalQteSource: ls.totalQteSource, totalDecProduction: ls.totalDecProduction, pcs: Math.round(pcs*100)/100 },
        causes7M: {
          matierePremiere : { quantite: ls.causes7M.matierePremiere, pourcentage: c(ls.causes7M.matierePremiere), references: ls.referencesMP    },
          absence         : { quantite: ls.causes7M.absence,         pourcentage: c(ls.causes7M.absence)                                         },
          rendement       : { quantite: ls.causes7M.rendement,       pourcentage: c(ls.causes7M.rendement)                                       },
          methode         : { quantite: ls.causes7M.methode,         pourcentage: c(ls.causes7M.methode)                                         },
          maintenance     : { quantite: ls.causes7M.maintenance,     pourcentage: c(ls.causes7M.maintenance)                                     },
          qualite         : { quantite: ls.causes7M.qualite,         pourcentage: c(ls.causes7M.qualite),         references: ls.referencesQualite },
          environnement   : { quantite: ls.causes7M.environnement,   pourcentage: c(ls.causes7M.environnement)                                   },
        },
        detailsReferences: Object.values(ls.detailsReferences),
        oee: null
      };
    });

    lignesFormatees.sort((a, b) => a.ligne.localeCompare(b.ligne));
    return { statsParLigne: lignesFormatees, resume7M: this.calculerResume7M(totaux7MGlobaux, lignesFormatees) };
  }

  private async getDetailsNonConformitesPourPeriode(
    semaines: string[], dateDebut: string, dateFin: string,
    estMemeDate: boolean = false, poste?: string // ✅
  ): Promise<any[]> {
    try {
      const planifications = await this.planificationRepository.find({
        where: semaines.map(s => ({ semaine: s, ...this.buildPosteWhere(poste) })), // ✅
        relations: ['nonConformites', 'nonConformites.commentaireObjet'],
        order: { ligne: 'ASC', semaine: 'ASC', jour: 'ASC', reference: 'ASC' }
      });
      if (planifications.length === 0) return [];

      const details: any[] = [];
      const dateDebutObj = new Date(dateDebut), dateFinObj = new Date(dateFin);

      for (const plan of planifications) {
        const datePlan    = await this.getDateFromSemaineJour(plan.semaine, plan.jour);
        const datePlanObj = new Date(datePlan);
        if (estMemeDate) { if (datePlan !== dateDebut) continue; }
        else             { if (datePlanObj < dateDebutObj || datePlanObj > dateFinObj) continue; }

        const qs = this.getQuantitySource(plan);
        const detail: any = {
          date: datePlan, jour: plan.jour, semaine: plan.semaine, ligne: plan.ligne,
          reference: plan.reference, of: plan.of||'',
          poste: plan.poste, // ✅ NOUVEAU
          qtyPlanifiee: plan.qtePlanifiee, qtyModifiee: plan.qteModifiee,
          qtyProduite: plan.decProduction, delta: plan.decProduction - qs,
          pcsProd: plan.pcsProd||0,
          m1_matierePremiere:0, m2_absence:0, m3_rendement:0, m4_methode:0,
          m5_maintenance:0, m6_qualite:0, m7_environnement:0, total7M:0, pourcentageEcart:0,
          refMP:null, refQualite:null, commentaire:null
        };
        if (plan.nonConformites?.length > 0) {
          const nc = plan.nonConformites[0];
          detail.m1_matierePremiere = nc.matierePremiere;
          detail.m2_absence         = nc.absence;
          detail.m3_rendement       = nc.rendement;
          detail.m4_methode         = nc.methode;
          detail.m5_maintenance     = nc.maintenance;
          detail.m6_qualite         = nc.qualite;
          detail.m7_environnement   = nc.environnement;
          detail.total7M            = nc.total;
          detail.refMP              = nc.referenceMatierePremiere;
          detail.refQualite         = nc.referenceQualite;
          detail.commentaire        = nc.commentaire;
          if (qs > 0) detail.pourcentageEcart = (nc.total / qs) * 100;
        }
        if (detail.total7M > 0) details.push(detail);
      }
      return details;
    } catch (error) {
      console.error('Erreur getDetailsNonConformitesPourPeriode:', error);
      return [];
    }
  }

  // ─── Méthodes utilitaires ─────────────────────────────────────────────────────

  private async calculerProductiviteEt7MPourOuvrier(
    matricule: number, semaine: string, jour: string, ligne: string, poste?: string // ✅
  ): Promise<{ productivite: number; causes7M: any }> {
    try {
      const rapportsOuvrier = await this.saisieRapportRepository.find({
        where: { matricule, semaine, jour, ligne }
      });
      if (rapportsOuvrier.length === 0) return this.zeroProductivite();

      const planifications = await this.planificationRepository.find({
        where: { semaine, jour, ligne, ...this.buildPosteWhere(poste) }, // ✅
        relations: ['nonConformites']
      });
      if (planifications.length === 0) return this.zeroProductivite();

      const totalHeuresLigne  = rapportsOuvrier.reduce((s, r) => s + r.totalHeuresJour, 0);
      if (totalHeuresLigne <= 0) return this.zeroProductivite();

      const totalDecProductionLigne = planifications.reduce((s, p) => s + p.decProduction, 0);
      const totalQteSourceLigne     = planifications.reduce((s, p) => s + this.getQuantitySource(p), 0);
      const productivite = totalQteSourceLigne > 0
        ? (totalDecProductionLigne / totalQteSourceLigne) * 100 : 0;

      const totaux = { matierePremiere:0, absence:0, rendement:0, methode:0, maintenance:0, qualite:0, environnement:0 };
      planifications.forEach(p => {
        if (p.nonConformites?.length > 0) {
          const nc = p.nonConformites[0];
          totaux.matierePremiere += nc.matierePremiere;
          totaux.absence         += nc.absence;
          totaux.rendement       += nc.rendement;
          totaux.methode         += nc.methode;
          totaux.maintenance     += nc.maintenance;
          totaux.qualite         += nc.qualite;
          totaux.environnement   += nc.environnement;
        }
      });
      const cp7 = (v: number) => totalQteSourceLigne <= 0 ? 0 : Math.round((v/totalQteSourceLigne)*100*10)/10;
      return {
        productivite: Math.round(productivite * 100) / 100,
        causes7M: {
          matierePremiere: cp7(totaux.matierePremiere), absence:    cp7(totaux.absence),
          rendement:       cp7(totaux.rendement),       methode:    cp7(totaux.methode),
          maintenance:     cp7(totaux.maintenance),     qualite:    cp7(totaux.qualite),
          environnement:   cp7(totaux.environnement)
        }
      };
    } catch { return this.zeroProductivite(); }
  }

  private zeroProductivite() {
    return {
      productivite: 0,
      causes7M: { matierePremiere:0, absence:0, rendement:0, methode:0, maintenance:0, qualite:0, environnement:0 }
    };
  }

  private async mettreAJourStatutsAutomatiques(semaine: string, jour: string, date: string) {
    const rapports = await this.saisieRapportRepository.find({ where: { semaine, jour } });
    for (const rapport of rapports) {
      await this.statutOuvrierRepository.upsert(
        { matricule: rapport.matricule, nomPrenom: rapport.nomPrenom, date, statut: 'P' },
        ['matricule', 'date']
      );
    }
  }

  private convertirDateEnSemaineEtJour(dateStr: string): { semaine: string; jour: string } {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new BadRequestException(`Date invalide: ${dateStr}`);
    const getISOWeeks = (d: Date) => {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    };
    const semaine = `semaine${getISOWeeks(date)}`;
    const joursMap = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const jour = joursMap[date.getDay()];
    console.log(`[CONVERSION] ${dateStr} → ${semaine}, ${jour}`);
    return { semaine, jour };
  }

  private async getSemainesEntreDates(dateDebut: string, dateFin: string): Promise<string[]> {
    const debut = new Date(dateDebut), fin = new Date(dateFin);
    const semaines = await this.semaineRepository
      .createQueryBuilder('semaine')
      .where('semaine.dateDebut <= :fin',   { fin:   fin.toISOString().split('T')[0] })
      .andWhere('semaine.dateFin >= :debut', { debut: debut.toISOString().split('T')[0] })
      .orderBy('semaine.dateDebut', 'ASC')
      .getMany();
    if (semaines.length === 0 && dateDebut === dateFin) {
      const s = await this.semaineRepository
        .createQueryBuilder('semaine')
        .where(':date BETWEEN semaine.dateDebut AND semaine.dateFin', { date: dateDebut })
        .getOne();
      if (s) return [s.nom];
    }
    return semaines.map(s => s.nom);
  }

  private async getDateFromSemaineJour(semaine: string, jour: string): Promise<string> {
    try {
      const s = await this.semaineRepository.findOne({ where: { nom: semaine } });
      if (!s) return new Date().toISOString().split('T')[0];
      const d = s.dateDebut instanceof Date ? s.dateDebut : new Date(s.dateDebut);
      const joursIndex: Record<string, number> = { lundi:0, mardi:1, mercredi:2, jeudi:3, vendredi:4, samedi:5, dimanche:6 };
      const r = new Date(d);
      r.setDate(d.getDate() + (joursIndex[jour.toLowerCase()] || 0));
      return r.toISOString().split('T')[0];
    } catch { return new Date().toISOString().split('T')[0]; }
  }

  private calculerProductionGlobale(statsParLigne: any[]) {
    const totalQteSource    = statsParLigne.reduce((s, l) => s + l.production.totalQteSource,    0);
    const totalDecProduction = statsParLigne.reduce((s, l) => s + l.production.totalDecProduction, 0);
    const pcsTotal = totalQteSource > 0 ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100 : 0;
    return { totalQteSource, totalDecProduction, pcsTotal };
  }

  private calculerResume7M(totaux7MGlobaux: any, lignesFormatees: any[]) {
    const totalQteSource = lignesFormatees.reduce((s, l) => s + l.production.totalQteSource, 0);
    const cp = (v: number) => totalQteSource <= 0 ? 0 : Math.round((v/totalQteSource)*100*10)/10;
    return {
      totaux: { ...totaux7MGlobaux },
      pourcentages: {
        matierePremiere: cp(totaux7MGlobaux.matierePremiere), absence:      cp(totaux7MGlobaux.absence),
        rendement:       cp(totaux7MGlobaux.rendement),       methode:      cp(totaux7MGlobaux.methode),
        maintenance:     cp(totaux7MGlobaux.maintenance),     qualite:      cp(totaux7MGlobaux.qualite),
        environnement:   cp(totaux7MGlobaux.environnement)
      }
    };
  }

  private async calculerPersonnelPourPeriode(dateDebut: string, dateFin: string, estMemeDate: boolean = false) {
    try {
      const totalOuvriers = await this.calculerTotalOuvriers();

      if (estMemeDate) {
        const { semaine, jour } = this.convertirDateEnSemaineEtJour(dateDebut);
        const res = await this.saisieRapportRepository.createQueryBuilder('r').select('COUNT(DISTINCT r.matricule)','count').where('r.semaine=:semaine',{semaine}).andWhere('r.jour=:jour',{jour}).getRawOne();
        const rapportsJour  = parseInt(res?.count??'0',10);
        const congesJour    = await this.statutOuvrierRepository.createQueryBuilder('s').where('s.date=:d',{d:dateDebut}).andWhere('s.statut=:st',{st:'C'}).getCount();
        const absencesJour  = await this.statutOuvrierRepository.createQueryBuilder('s').where('s.date=:d',{d:dateDebut}).andWhere('s.statut=:st',{st:'AB'}).getCount();
        const selectionsJour= await this.statutOuvrierRepository.createQueryBuilder('s').where('s.date=:d',{d:dateDebut}).andWhere('s.statut=:st',{st:'S'}).getCount();
        const autres = totalOuvriers - rapportsJour - congesJour - absencesJour - selectionsJour;
        const tauxPresence = totalOuvriers > 0 ? Math.round(((rapportsJour+selectionsJour)/totalOuvriers)*100*10)/10 : 0;
        return { totalOuvriers, totalPresences:rapportsJour, totalSelections:selectionsJour, totalConges:congesJour, totalAbsences:absencesJour, autres, moyennePresences:rapportsJour, moyenneSelections:selectionsJour, moyenneConges:congesJour, moyenneAbsences:absencesJour, moyenneAutres:autres, tauxPresence, joursDansPeriode:1, detailsParJour:{presences:{[dateDebut]:rapportsJour},selections:{[dateDebut]:selectionsJour},conges:{[dateDebut]:congesJour},absences:{[dateDebut]:absencesJour},autres:{[dateDebut]:autres}}, presents:rapportsJour, selections:selectionsJour, conges:congesJour, absents:absencesJour, autresStatuts:autres };
      }

      const semaines = await this.getSemainesEntreDates(dateDebut, dateFin);
      const joursDansPeriode = this.calculerNombreJoursPeriode(dateDebut, dateFin);
      let totalPresences=0,totalSelections=0,totalConges=0,totalAbsences=0;
      const presencesParJour:any={}, selectionsParJour:any={}, congesParJour:any={}, absencesParJour:any={};

      for (const semaine of semaines) {
        for (const jour of ['lundi','mardi','mercredi','jeudi','vendredi','samedi']) {
          const dateReelle = await this.getDateFromSemaineJour(semaine, jour);
          if (!this.dateEstDansPlage(new Date(dateReelle), new Date(dateDebut), new Date(dateFin))) continue;
          const r = await this.saisieRapportRepository.createQueryBuilder('r').select('COUNT(DISTINCT r.matricule)','count').where('r.semaine=:semaine',{semaine}).andWhere('r.jour=:jour',{jour}).getRawOne();
          const rp = parseInt(r?.count??'0',10);
          totalPresences += rp; presencesParJour[dateReelle] = rp;
          const sel = await this.statutOuvrierRepository.createQueryBuilder('s').where('s.date=:d',{d:dateReelle}).andWhere('s.statut=:st',{st:'S'}).getCount();
          totalSelections += sel; selectionsParJour[dateReelle] = sel;
          const cg = await this.statutOuvrierRepository.createQueryBuilder('s').where('s.date=:d',{d:dateReelle}).andWhere('s.statut=:st',{st:'C'}).getCount();
          totalConges += cg; congesParJour[dateReelle] = cg;
          const ab = await this.statutOuvrierRepository.createQueryBuilder('s').where('s.date=:d',{d:dateReelle}).andWhere('s.statut=:st',{st:'AB'}).getCount();
          totalAbsences += ab; absencesParJour[dateReelle] = ab;
        }
      }
      const moy = (v:number) => joursDansPeriode > 0 ? Math.round((v/joursDansPeriode)*10)/10 : 0;
      const autres = (totalOuvriers*joursDansPeriode) - totalPresences - totalSelections - totalConges - totalAbsences;
      const tauxPresence = totalOuvriers>0&&joursDansPeriode>0 ? Math.round(((totalPresences+totalSelections)/(totalOuvriers*joursDansPeriode))*100*10)/10 : 0;
      return { totalOuvriers, totalPresences, totalSelections, totalConges, totalAbsences, autres, moyennePresences:moy(totalPresences), moyenneSelections:moy(totalSelections), moyenneConges:moy(totalConges), moyenneAbsences:moy(totalAbsences), moyenneAutres:moy(autres), tauxPresence, joursDansPeriode, detailsParJour:{presences:presencesParJour,selections:selectionsParJour,conges:congesParJour,absences:absencesParJour}, presents:Math.round(moy(totalPresences)), selections:Math.round(moy(totalSelections)), conges:Math.round(moy(totalConges)), absents:Math.round(moy(totalAbsences)), autresStatuts:Math.round(moy(autres)) };
    } catch (error) {
      console.error('Erreur calculerPersonnelPourPeriode:', error);
      return { totalOuvriers:0, totalPresences:0, totalSelections:0, totalConges:0, totalAbsences:0, autres:0, moyennePresences:0, moyenneSelections:0, moyenneConges:0, moyenneAbsences:0, moyenneAutres:0, tauxPresence:0, joursDansPeriode:0, detailsParJour:{presences:{},selections:{},conges:{},absences:{}}, presents:0, selections:0, conges:0, absents:0, autresStatuts:0 };
    }
  }

  private async calculerTotalOuvriers(): Promise<number> {
    const r = await this.ouvrierRepository.createQueryBuilder('o').select('COUNT(*)','count').where('o.nomPrenom NOT LIKE :p',{p:'S %'}).getRawOne();
    return parseInt(r?.count??'0',10);
  }

  private genererDatesEntre(debut: Date, fin: Date): Date[] {
    const dates: Date[] = [];
    const d = new Date(debut);
    while (d <= fin) { dates.push(new Date(d)); d.setDate(d.getDate()+1); }
    return dates;
  }

  private calculerNombreJoursPeriode(dateDebut: string, dateFin: string): number {
    const d1 = new Date(dateDebut), d2 = new Date(dateFin);
    return Math.floor((d2.getTime()-d1.getTime())/(1000*60*60*24))+1;
  }

  private dateEstDansPlage(date: Date, debut: Date, fin: Date): boolean {
    const n = (d:Date) => new Date(d.getFullYear(),d.getMonth(),d.getDate());
    return n(date) >= n(debut) && n(date) <= n(fin);
  }

  async getAllStats(semaine?: string) { /* à implémenter si besoin */ }
  private buildPosteWhere(poste?: string): Pick<Planification, 'poste'> | Record<string, never> {
  return poste ? { poste } : {};
}
async getStatsPersonnesSelection(dto: GetStatsSelectionDto): Promise<any> {
  const { dateDebut, dateFin } = dto;
 
  // ── Validation des dates ───────────────────────────────────────────────────
  const debut = new Date(dateDebut);
  const fin   = new Date(dateFin);
 
  if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
    throw new BadRequestException('Format de date invalide');
  }
  if (debut > fin) {
    throw new BadRequestException('La date de début doit être avant la date de fin');
  }
 
  // ── Récupérer tous les plannings de la période ─────────────────────────────
  // On ramène uniquement les colonnes utiles (date + matricule + nomPrenom)
  // pour limiter la charge mémoire.
  const plannings = await this.planningSelectionRepository
    .createQueryBuilder('ps')
    .select('ps.date',      'date')
    .addSelect('ps.matricule', 'matricule')
    .addSelect('ps.nomPrenom', 'nomPrenom')
    .where('ps.date BETWEEN :dateDebut AND :dateFin', { dateDebut, dateFin })
    .orderBy('ps.date', 'ASC')
    .addOrderBy('ps.matricule', 'ASC')
    .getRawMany();
 
  // ── Détail par jour ────────────────────────────────────────────────────────
  // Map<date, Map<matricule, nomPrenom>>
  const parJourMap = new Map<string, Map<number, string>>();
 
  for (const row of plannings) {
    const date      = row.date as string;         // format YYYY-MM-DD
    const matricule = Number(row.matricule);
    const nomPrenom = row.nomPrenom as string;
 
    if (!parJourMap.has(date)) {
      parJourMap.set(date, new Map());
    }
    // Set garantit l'unicité par matricule pour ce jour
    parJourMap.get(date)!.set(matricule, nomPrenom);
  }
 
  // Formater le détail par jour (trié chronologiquement)
  const detailParJour = [...parJourMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ouvrierMap]) => ({
      date,
      nombrePersonnes: ouvrierMap.size,
      ouvriers: [...ouvrierMap.entries()].map(([matricule, nomPrenom]) => ({
        matricule,
        nomPrenom,
      })),
    }));
 
  // ── Total global : matricules distincts sur toute la période ───────────────
  const matriculesDistincts = new Map<number, string>();
  for (const row of plannings) {
    matriculesDistincts.set(Number(row.matricule), row.nomPrenom as string);
  }
 
  const totalPersonnesDistinctes = plannings.length;
 
  // ── Moyenne journalière ────────────────────────────────────────────────────
  const nombreJours = detailParJour.length; // jours qui ont au moins 1 entrée
  const moyenneParJour =
    nombreJours > 0
      ? Number((totalPersonnesDistinctes / nombreJours).toFixed(2))
      : 0;
 
  // ── Réponse ────────────────────────────────────────────────────────────────
  return {
    message: `Statistiques personnes en sélection du ${dateDebut} au ${dateFin}`,
    periode: {
      dateDebut,
      dateFin,
      dateCalcul: new Date().toISOString(),
    },
    global: {
      totalPersonnesDistinctes,
  totalAffectations: plannings.length,
  nombreJoursAvecActivite: nombreJours,
  moyennePersonnesParJour: moyenneParJour,
  listeOuvriersDistincts: [...matriculesDistincts.entries()].map(
    ([matricule, nomPrenom]) => ({ matricule, nomPrenom }),
      ),
    },
    detailParJour,
  };
}
}