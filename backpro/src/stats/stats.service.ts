// src/stats/stats.service.ts
import { Injectable, NotFoundException, InternalServerErrorException,BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Planification } from '../semaine/entities/planification.entity';
import { NonConformite } from '../non-conf/entities/non-conf.entity';
import { SaisieRapport } from '../saisie-rapport/entities/saisie-rapport.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { GetStatsDateDto } from './dto/get-stats-date.dto';
import { Semaine } from '../semaine/entities/semaine.entity';
import {MoreThanOrEqual, LessThanOrEqual} from "typeorm";
import { GetStats5MDateDto } from './dto/get-stats-5m-date.dto';
import { StatutOuvrier } from 'src/statut/entities/statut-ouvrier.entity';
import { In } from 'typeorm';
import { GetStatsPeriodeDto } from './dto/get-stats-periode.dto';
import { Between } from 'typeorm';
import { PlanningSelection } from 'src/planning-selection/entities/planning-selection.entity';


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

  // Méthode utilitaire pour obtenir la quantité source
  private getQuantitySource(plan: Planification): number {
    return plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee;
  }

  // ✅ NOUVELLE MÉTHODE : Calculer le pourcentage des 5M basé sur qtePlanifiee
  private calculerPourcentage5M(valeurM: number, qtePlanifiee: number): number {
    if (qtePlanifiee <= 0) return 0;
    const pourcentage = (valeurM / qtePlanifiee) * 100;
    return Math.round(pourcentage * 10) / 10;
  }

  // Méthode pour calculer le pourcentage d'écart
  private calculerEcartPourcentage(total5M: number, quantiteSource: number): number {
    if (quantiteSource <= 0) return 0;
    const pourcentage = (total5M / quantiteSource) * 100;
    return Math.round(pourcentage * 10) / 10;
  }

  async getStatsBySemaineAndLigne(semaine: string, ligne: string) {
    console.log(`=== CALCUL STATISTIQUES POUR ${ligne} - ${semaine} ===`);

    // 1. Récupérer toutes les planifications pour cette semaine et ligne
    const planifications = await this.planificationRepository.find({
      where: { 
        semaine: semaine,
        ligne: ligne
      },
      relations: ['nonConformites'],
      order: { jour: 'ASC', reference: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la ligne ${ligne} dans la semaine ${semaine}`
      );
    }

    // 2. Initialiser les totaux
    let totalQtePlanifiee = 0;
    let totalQteModifiee = 0;
    let totalQteSource = 0;
    let totalDecProduction = 0;
    let totalDeltaProd = 0;
    
    // Pour les non-conformités - 7M
    let totalEcart = 0; // Somme des totaux 7M
    let totalEcartMatierePremiere = 0;
    let totalEcartAbsence = 0;
    let totalEcartRendement = 0;
    let totalEcartMethode = 0;
    let totalEcartMaintenance = 0;
    let totalEcartQualite = 0;
    let totalEcartEnvironnement = 0; // ✅ AJOUTÉ

    // Groupement par référence
    const statsParReference: Record<string, any> = {};
    const referencesUniques = new Set<string>();

    // 3. Parcourir toutes les planifications
    for (const plan of planifications) {
      const quantiteSource = this.getQuantitySource(plan);
      
      // Mise à jour des totaux globaux
      totalQtePlanifiee += plan.qtePlanifiee;
      totalQteModifiee += plan.qteModifiee;
      totalQteSource += quantiteSource;
      totalDecProduction += plan.decProduction;
      totalDeltaProd += plan.deltaProd;

      // Grouper par référence
      if (!statsParReference[plan.reference]) {
        statsParReference[plan.reference] = {
          reference: plan.reference,
          totalQtePlanifiee: 0,
          totalQteModifiee: 0,
          totalQteSource: 0,
          totalDecProduction: 0,
          totalEcart: 0,
          detailsParJour: {},
          nonConformites: []
        };
      }

      // Mise à jour des stats par référence
      const refStats = statsParReference[plan.reference];
      refStats.totalQtePlanifiee += plan.qtePlanifiee;
      refStats.totalQteModifiee += plan.qteModifiee;
      refStats.totalQteSource += quantiteSource;
      refStats.totalDecProduction += plan.decProduction;

      // Initialiser le jour dans la référence
      if (!refStats.detailsParJour[plan.jour]) {
        refStats.detailsParJour[plan.jour] = {
          qtePlanifiee: 0,
          qteModifiee: 0,
          qteSource: 0,
          decProduction: 0,
          pcsProd: 0,
          ecart: 0,
          ecartPourcentage: 0
        };
      }

      const jourStats = refStats.detailsParJour[plan.jour];
      jourStats.qtePlanifiee += plan.qtePlanifiee;
      jourStats.qteModifiee += plan.qteModifiee;
      jourStats.qteSource += quantiteSource;
      jourStats.decProduction += plan.decProduction;
      jourStats.pcsProd = jourStats.qteSource > 0 ? 
        (jourStats.decProduction / jourStats.qteSource) * 100 : 0;

      // Traitement des non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        // Totaux globaux par cause
        totalEcart += nonConf.total;
        totalEcartMatierePremiere += nonConf.matierePremiere;
        totalEcartAbsence += nonConf.absence;
        totalEcartRendement += nonConf.rendement;
        totalEcartMethode += nonConf.methode;
        totalEcartMaintenance += nonConf.maintenance;
        totalEcartQualite += nonConf.qualite;
        totalEcartEnvironnement += nonConf.environnement; // ✅ AJOUTÉ

        // Mise à jour référence
        refStats.totalEcart += nonConf.total;
        jourStats.ecart += nonConf.total;
        jourStats.ecartPourcentage = this.calculerEcartPourcentage(
          jourStats.ecart,
          jourStats.qteSource
        );

        // Ajouter détail non-conformité
        refStats.nonConformites.push({
          jour: plan.jour,
          matierePremiere: nonConf.matierePremiere,
          referenceMatierePremiere: nonConf.referenceMatierePremiere,
          absence: nonConf.absence,
          rendement: nonConf.rendement,
          methode: nonConf.methode,
          maintenance: nonConf.maintenance,
          qualite: nonConf.qualite,
          environnement: nonConf.environnement, // ✅ AJOUTÉ
          total: nonConf.total,
          ecartPourcentage: nonConf.ecartPourcentage || this.calculerEcartPourcentage(nonConf.total, quantiteSource),
          commentaire: nonConf.commentaire
        });
      }

      referencesUniques.add(plan.reference);
    }

    // 4. Calculer les pourcentages finaux
    const pcsProdTotal = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;
    const pourcentageTotalEcart = totalQteSource > 0 ? (totalEcart / totalQteSource) * 100 : 0;

     const pcsProdTotalArrondi = Math.round(pcsProdTotal * 100) / 100;
    // ✅ MODIFICATION : Calculer la répartition des écarts par cause basée sur qtePlanifiee
    const repartitionEcartParCause = {
      matierePremiere: {
        quantite: totalEcartMatierePremiere,
        pourcentage: this.calculerPourcentage5M(totalEcartMatierePremiere, totalQtePlanifiee)
      },
      absence: {
        quantite: totalEcartAbsence,
        pourcentage: this.calculerPourcentage5M(totalEcartAbsence, totalQtePlanifiee)
      },
      rendement: {
        quantite: totalEcartRendement,
        pourcentage: this.calculerPourcentage5M(totalEcartRendement, totalQtePlanifiee)
      },
       methode: {
        quantite: totalEcartMethode,
        pourcentage: this.calculerPourcentage5M(totalEcartMethode, totalQtePlanifiee)
      },
      maintenance: {
        quantite: totalEcartMaintenance,
        pourcentage: this.calculerPourcentage5M(totalEcartMaintenance, totalQtePlanifiee)
      },
      qualite: {
        quantite: totalEcartQualite,
        pourcentage: this.calculerPourcentage5M(totalEcartQualite, totalQtePlanifiee)
      },
      environnement: { // ✅ AJOUTÉ
        quantite: totalEcartEnvironnement,
        pourcentage: this.calculerPourcentage5M(totalEcartEnvironnement, totalQtePlanifiee)
      }
    };

    // 6. Formater les stats par référence
    const statsParReferenceFormate = Object.values(statsParReference).map((ref: any) => {
      const pcsProdRef = ref.totalQteSource > 0 ? 
        (ref.totalDecProduction / ref.totalQteSource) * 100 : 0;
      
      const pourcentageEcartRef = ref.totalQteSource > 0 ? 
        (ref.totalEcart / ref.totalQteSource) * 100 : 0;

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

    // 7. Préparer la réponse finale
    const response = {
      message: `Statistiques pour la ligne ${ligne} - Semaine ${semaine}`,
      periode: {
        semaine: semaine,
        ligne: ligne,
        dateCalcul: new Date().toISOString()
      },
      resumeGeneral: {
        nombrePlanifications: planifications.length,
        nombreReferences: referencesUniques.size,
        totalQtePlanifiee: totalQtePlanifiee,
        totalQteModifiee: totalQteModifiee,
        totalQteSource: totalQteSource,
        totalDecProduction: totalDecProduction,
        deltaProdTotal: totalDeltaProd,
        pcsProdTotal: Math.round(pcsProdTotal * 100) / 100,
        totalEcart: totalEcart,
         pcsProdTotalPourcentage: `${pcsProdTotalArrondi}%`,
        pourcentageTotalEcart: Math.round(pourcentageTotalEcart * 10) / 10
      },
      repartitionEcartParCause,
      statsParReference: statsParReferenceFormate,
      details: planifications.map(plan => ({
        id: plan.id,
        jour: plan.jour,
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

    console.log(`=== FIN STATISTIQUES POUR ${ligne} - ${semaine} ===`);
    return response;
  }
  

  // Méthode pour obtenir toutes les statistiques (si besoin)
  async getAllStats(semaine?: string) {
    // Logique pour récupérer toutes les statistiques
    // (à implémenter si nécessaire)
  }
  // Modifications dans stats.service.ts
// Ajoutez cette méthode à la fin de la classe StatsService :

async getPcsProdTotalParLigne(semaine: string) {
  console.log(`=== CALCUL PCS PROD TOTAL PAR LIGNE POUR ${semaine} ===`);

  // 1. Récupérer toutes les planifications pour cette semaine
  const planifications = await this.planificationRepository.find({
    where: { 
      semaine: semaine
    },
    relations: ['nonConformites'],
    order: { ligne: 'ASC', jour: 'ASC', reference: 'ASC' }
  });

  if (planifications.length === 0) {
    throw new NotFoundException(
      `Aucune planification trouvée pour la semaine ${semaine}`
    );
  }

  // 2. Grouper par ligne
  const statsParLigne: Record<string, any> = {};

  // 3. Parcourir toutes les planifications
  for (const plan of planifications) {
    const quantiteSource = this.getQuantitySource(plan);
    const ligne = plan.ligne;
    
    // Initialiser la ligne si elle n'existe pas
    if (!statsParLigne[ligne]) {
      statsParLigne[ligne] = {
        ligne: ligne,
        totalQteSource: 0,
        totalDecProduction: 0,
        nombreReferences: new Set<string>(),
        nombrePlanifications: 0,
        detailsParReference: {}
      };
    }

    // Mise à jour des totaux par ligne
    const ligneStats = statsParLigne[ligne];
    ligneStats.totalQteSource += quantiteSource;
    ligneStats.totalDecProduction += plan.decProduction;
    ligneStats.nombrePlanifications += 1;
    ligneStats.nombreReferences.add(plan.reference);

    // Détails par référence (optionnel)
    if (!ligneStats.detailsParReference[plan.reference]) {
      ligneStats.detailsParReference[plan.reference] = {
        totalQteSource: 0,
        totalDecProduction: 0
      };
    }
    ligneStats.detailsParReference[plan.reference].totalQteSource += quantiteSource;
    ligneStats.detailsParReference[plan.reference].totalDecProduction += plan.decProduction;
  }

  // 4. Formater la réponse
  const resultat = Object.values(statsParLigne).map((ligne: any) => {
    const pcsProdTotal = ligne.totalQteSource > 0 ? 
      (ligne.totalDecProduction / ligne.totalQteSource) * 100 : 0;

    return {
      ligne: ligne.ligne,
      nombrePlanifications: ligne.nombrePlanifications,
      nombreReferences: ligne.nombreReferences.size,
      totalQteSource: ligne.totalQteSource,
      totalDecProduction: ligne.totalDecProduction,
      pcsProdTotal: Math.round(pcsProdTotal * 100) / 100,
      // Optionnel: ajouter les références avec leur pcsProd
      references: Object.entries(ligne.detailsParReference).map(([ref, data]: [string, any]) => ({
        reference: ref,
        pcsProd: Math.round((data.totalDecProduction / data.totalQteSource) * 10000) / 100
      }))
    };
  });
   const totalSemaineQteSource = resultat.reduce((sum, l) => sum + l.totalQteSource, 0);
  const totalSemaineDecProduction = resultat.reduce((sum, l) => sum + l.totalDecProduction, 0);
  
  const pcsTotalSemaine = totalSemaineQteSource > 0
    ? Math.round((totalSemaineDecProduction / totalSemaineQteSource) * 100 * 100) / 100
    : 0;

  // 5. Trier par ligne (optionnel)
  resultat.sort((a, b) => a.ligne.localeCompare(b.ligne));

  console.log(`=== FIN PCS PROD TOTAL PAR LIGNE POUR ${semaine} ===`);
  return {
    message: `PCS Prod Total par ligne pour la semaine ${semaine}`,
    semaine: semaine,
    dateCalcul: new Date().toISOString(),
    nombreLignes: resultat.length,
    // ✅ AJOUTÉ : Résumé global avec PCS total
    resumeGlobalSemaine: {
      totalQteSource: totalSemaineQteSource,
      totalDecProduction: totalSemaineDecProduction,
      pcsTotalSemaine: pcsTotalSemaine,
      pcsTotalSemainePourcentage: `${pcsTotalSemaine}%`
    },
    lignes: resultat
  };
}
async getStatsPourcentage5MParSemaine(semaine: string) {
  console.log(`=== CALCUL POURCENTAGE 5M POUR SEMAINE ${semaine} ===`);

  try {
    // 1. Récupérer toutes les planifications de la semaine
    const planifications = await this.planificationRepository.find({
      where: { semaine: semaine },
      relations: ['nonConformites']
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la semaine ${semaine}`
      );
    }

    // 2. Calculer la quantité totale planifiée
    let totalQuantitePlanifiee = 0;
    
    // 3. Initialiser les totaux pour chaque cause 5M
    let totalMatierePremiere = 0;
    let totalAbsence = 0;
    let totalRendement = 0;
    let totalMethode = 0;
    let totalMaintenance = 0;
    let totalQualite = 0;
    let totalEnvironnement = 0; // ✅ AJOUTÉ
    let total5M = 0;

    // 4. Parcourir toutes les planifications
    for (const plan of planifications) {
      // ✅ MODIFICATION : Utiliser qtePlanifiee au lieu de quantiteSource
      totalQuantitePlanifiee += plan.qtePlanifiee;

      // Vérifier s'il y a des non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0]; // Normalement une seule
        
        // Ajouter aux totaux par cause
        totalMatierePremiere += nonConf.matierePremiere;
        totalAbsence += nonConf.absence;
        totalRendement += nonConf.rendement;
        totalMethode += nonConf.methode;
        totalMaintenance += nonConf.maintenance;
        totalQualite += nonConf.qualite;
        totalEnvironnement += nonConf.environnement; // ✅ AJOUTÉ
        
        // Total 5M
        total5M += nonConf.total;
      }
    }

    console.log('Totaux calculés:', {
      totalQuantitePlanifiee,
      totalMatierePremiere,
      totalAbsence,
      totalRendement,
      totalMethode,
      totalMaintenance,
      totalQualite,
      totalEnvironnement, // ✅ AJOUTÉ
      total5M
    });

    // 5. Calculer les pourcentages
    const calculerPourcentage = (totalCause: number): number => {
      if (totalQuantitePlanifiee <= 0) return 0;
      const pourcentage = (totalCause / totalQuantitePlanifiee) * 100;
      return Math.round(pourcentage * 10) / 10; // Une décimale
    };

    const pourcentageMatierePremiere = calculerPourcentage(totalMatierePremiere);
    const pourcentageAbsence = calculerPourcentage(totalAbsence);
    const pourcentageRendement = calculerPourcentage(totalRendement);
    const pourcentageMethode = calculerPourcentage(totalMethode);
    const pourcentageMaintenance = calculerPourcentage(totalMaintenance);
    const pourcentageQualite = calculerPourcentage(totalQualite);
    const pourcentageEnvironnement = calculerPourcentage(totalEnvironnement); // ✅ AJOUTÉ
    const pourcentageTotal5M = calculerPourcentage(total5M);

    // 6. Calculer la répartition des 5M (pourcentage de chaque cause dans le total 5M)
    const calculerPourcentageDans5M = (totalCause: number): number => {
      if (total5M <= 0) return 0;
      const pourcentage = (totalCause / total5M) * 100;
      return Math.round(pourcentage * 10) / 10; // Une décimale
    };

    const pourcentageDans5MMatierePremiere = calculerPourcentageDans5M(totalMatierePremiere);
    const pourcentageDans5MAbsence = calculerPourcentageDans5M(totalAbsence);
    const pourcentageDans5MRendement = calculerPourcentageDans5M(totalRendement);
    const pourcentageDans5MMethode = calculerPourcentageDans5M(totalMethode);
    const pourcentageDans5MMaintenance = calculerPourcentageDans5M(totalMaintenance);
    const pourcentageDans5MQualite = calculerPourcentageDans5M(totalQualite);
    const pourcentageDans5MEnvironnement = calculerPourcentageDans5M(totalEnvironnement); // ✅ AJOUTÉ

    // 7. Préparer la réponse
    const response = {
      message: `Pourcentages des 5M pour la semaine ${semaine}`,
      periode: {
        semaine: semaine,
        dateCalcul: new Date().toISOString(),
        nombrePlanifications: planifications.length
      },
      resume: {
        totalQuantitePlanifiee: totalQuantitePlanifiee,
        total5M: total5M,
        pourcentageTotal5M: `${pourcentageTotal5M}%`,
        pourcentageTotal5MNumber: pourcentageTotal5M
      },
      pourcentagesParCause: {
        matierePremiere: {
          total: totalMatierePremiere,
          pourcentage: `${pourcentageMatierePremiere}%`,
          pourcentageNumber: pourcentageMatierePremiere,
          pourcentageDansTotal5M: `${pourcentageDans5MMatierePremiere}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MMatierePremiere
        },
        absence: {
          total: totalAbsence,
          pourcentage: `${pourcentageAbsence}%`,
          pourcentageNumber: pourcentageAbsence,
          pourcentageDansTotal5M: `${pourcentageDans5MAbsence}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MAbsence
        },
        rendement: {
          total: totalRendement,
          pourcentage: `${pourcentageRendement}%`,
          pourcentageNumber: pourcentageRendement,
          pourcentageDansTotal5M: `${pourcentageDans5MRendement}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MRendement
        },
        methode: { // NOUVEAU
  total: totalMethode,
  pourcentage: `${pourcentageMethode}%`,
  pourcentageNumber: pourcentageMethode,
  pourcentageDansTotal5M: `${pourcentageDans5MMethode}%`,
  pourcentageDansTotal5MNumber: pourcentageDans5MMethode
},
        maintenance: {
          total: totalMaintenance,
          pourcentage: `${pourcentageMaintenance}%`,
          pourcentageNumber: pourcentageMaintenance,
          pourcentageDansTotal5M: `${pourcentageDans5MMaintenance}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MMaintenance
        },
        qualite: {
          total: totalQualite,
          pourcentage: `${pourcentageQualite}%`,
          pourcentageNumber: pourcentageQualite,
          pourcentageDansTotal5M: `${pourcentageDans5MQualite}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MQualite
        },
        environnement: { // ✅ AJOUTÉ
          total: totalEnvironnement,
          pourcentage: `${pourcentageEnvironnement}%`,  
          pourcentageDans5MQualiteNumber: pourcentageEnvironnement,
          pourcentageDansTotal5M: `${pourcentageDans5MEnvironnement}%`,
          pourcentageDansTotal5MNumber: pourcentageDans5MEnvironnement
        }
      },
      // Optionnel: Résumé en tableau pour faciliter l'affichage
      resumeTableau: [
        {
          cause: 'Matière Première',
          total: totalMatierePremiere,
          pourcentage: pourcentageMatierePremiere,
          pourcentageDans5M: pourcentageDans5MMatierePremiere
        },
        {
          cause: 'Absence',
          total: totalAbsence,
          pourcentage: pourcentageAbsence,
          pourcentageDans5M: pourcentageDans5MAbsence
        },
        {
          cause: 'Rendement',
          total: totalRendement,
          pourcentage: pourcentageRendement,
          pourcentageDans5M: pourcentageDans5MRendement
        },

        {
  cause: 'Méthode', // NOUVEAU
  total: totalMethode,
  pourcentage: pourcentageMethode,
  pourcentageDans5M: pourcentageDans5MMethode
},

        {
          cause: 'Maintenance',
          total: totalMaintenance,
          pourcentage: pourcentageMaintenance,
          pourcentageDans5M: pourcentageDans5MMaintenance
        },
        {
          cause: 'Qualité',
          total: totalQualite,
          pourcentage: pourcentageQualite,
          pourcentageDans5M: pourcentageDans5MQualite
        },
        {          cause: 'Environnement', // ✅ AJOUTÉ
          total: totalEnvironnement,
          pourcentage: pourcentageEnvironnement,
          pourcentageDans5M: pourcentageDans5MEnvironnement
        }
      ]
    };

    console.log(`=== FIN POURCENTAGE 5M POUR SEMAINE ${semaine} ===`);
    return response;

  } catch (error) {
    console.error(`Erreur dans getStatsPourcentage5MParSemaine:`, error);
    
    if (error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des pourcentages 5M: ${error.message}`
    );
  }
}
// Dans stats.service.ts - Ajoute cette nouvelle méthode
async getPourcentage5MParLigne(semaine: string) {
  console.log(`=== CALCUL POURCENTAGE 5M PAR LIGNE POUR SEMAINE ${semaine} ===`);

  try {
    // 1. Récupérer toutes les planifications de la semaine
    const planifications = await this.planificationRepository.find({
      where: { semaine: semaine },
      relations: ['nonConformites'],
      order: { ligne: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la semaine ${semaine}`
      );
    }

    // 2. Grouper les données par ligne
    const statsParLigne: Record<string, any> = {};

    // 3. Parcourir toutes les planifications
    for (const plan of planifications) {
      const ligne = plan.ligne;

      // Initialiser la ligne si elle n'existe pas
      if (!statsParLigne[ligne]) {
        statsParLigne[ligne] = {
          ligne: ligne,
          totalQtePlanifiee: 0,  // ✅ MODIFICATION : Utiliser qtePlanifiee
          matierePremiere: 0,
          absence: 0,
          rendement: 0,
           methode: 0,
          maintenance: 0,
          qualite: 0,
          environnement: 0, // ✅ AJOUTÉ
          total5M: 0,
          nombrePlanifications: 0,
          references: new Set<string>()
        };
      }

      // Mettre à jour les totaux
      const ligneStats = statsParLigne[ligne];
      ligneStats.totalQtePlanifiee += plan.qtePlanifiee;  // ✅ MODIFICATION : Utiliser qtePlanifiee
      ligneStats.nombrePlanifications += 1;
      ligneStats.references.add(plan.reference);

      // Ajouter les non-conformités si elles existent
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        ligneStats.matierePremiere += nonConf.matierePremiere;
        ligneStats.absence += nonConf.absence;
        ligneStats.rendement += nonConf.rendement;
        ligneStats.methode += nonConf.methode;
        ligneStats.maintenance += nonConf.maintenance;
        ligneStats.qualite += nonConf.qualite;
        ligneStats.environnement += nonConf.environnement; // ✅ AJOUTÉ
        ligneStats.total5M += nonConf.total;
      }
    }

    // 4. Fonction pour calculer le pourcentage
    const calculerPourcentage = (valeur: number, total: number): number => {
      if (total <= 0) return 0;
      return Math.round((valeur / total) * 100 * 10) / 10; // Une décimale
    };

    // 5. Calculer les pourcentages pour chaque ligne
    const resultats = Object.values(statsParLigne).map((ligne: any) => {
      // ✅ MODIFICATION : Utiliser totalQtePlanifiee au lieu de totalQuantiteSource
      const pourcentage5M = calculerPourcentage(ligne.total5M, ligne.totalQtePlanifiee);
      
      // Calculer la répartition des causes dans le total 5M
      const calculerPourcentageDans5M = (cause: number): number => {
        if (ligne.total5M <= 0) return 0;
        return Math.round((cause / ligne.total5M) * 100 * 10) / 10;
      };

      return {
        ligne: ligne.ligne,
        nombrePlanifications: ligne.nombrePlanifications,
        nombreReferences: ligne.references.size,
        totalQtePlanifiee: ligne.totalQtePlanifiee,  // ✅ MODIFICATION
        total5M: ligne.total5M,
        pourcentage5M: pourcentage5M,
        detailParCause: {
          matierePremiere: {
            quantite: ligne.matierePremiere,
            pourcentage: calculerPourcentageDans5M(ligne.matierePremiere),
            pourcentageDuTotal: calculerPourcentage(ligne.matierePremiere, ligne.totalQtePlanifiee)  // ✅ MODIFICATION
          },
          absence: {
            quantite: ligne.absence,
            pourcentage: calculerPourcentageDans5M(ligne.absence),
            pourcentageDuTotal: calculerPourcentage(ligne.absence, ligne.totalQtePlanifiee)  // ✅ MODIFICATION
          },
          rendement: {
            quantite: ligne.rendement,
            pourcentage: calculerPourcentageDans5M(ligne.rendement),
            pourcentageDuTotal: calculerPourcentage(ligne.rendement, ligne.totalQtePlanifiee)  // ✅ MODIFICATION
          },

          methode: {
            quantite: ligne.methode,
            pourcentage: calculerPourcentageDans5M(ligne.methode),
            pourcentageDuTotal: calculerPourcentage(ligne.methode, ligne.totalQtePlanifiee)  // ✅ MODIFICATION
          },
          maintenance: {
            quantite: ligne.maintenance,
            pourcentage: calculerPourcentageDans5M(ligne.maintenance),
            pourcentageDuTotal: calculerPourcentage(ligne.maintenance, ligne.totalQtePlanifiee)  // ✅ MODIFICATION
          },
          qualite: {
            quantite: ligne.qualite,
            pourcentage: calculerPourcentageDans5M(ligne.qualite),
            pourcentageDuTotal: calculerPourcentage(ligne.qualite, ligne.totalQtePlanifiee)  // ✅ MODIFICATION
          },
          environnement: {
            quantite: ligne.environnement,
            pourcentage: calculerPourcentageDans5M(ligne.environnement),
            pourcentageDuTotal: calculerPourcentage(ligne.environnement, ligne.totalQtePlanifiee)  // ✅ AJOUTÉ
          }
        },
        // Version simplifiée pour tableau
        resumeTableau: [
          { cause: 'Matière Première', quantite: ligne.matierePremiere, pourcentage5M: calculerPourcentageDans5M(ligne.matierePremiere) },
          { cause: 'Absence', quantite: ligne.absence, pourcentage5M: calculerPourcentageDans5M(ligne.absence) },
          { cause: 'Rendement', quantite: ligne.rendement, pourcentage5M: calculerPourcentageDans5M(ligne.rendement) },
          { cause: 'Méthode', quantite: ligne.methode, pourcentage5M: calculerPourcentageDans5M(ligne.methode) },
          { cause: 'Maintenance', quantite: ligne.maintenance, pourcentage5M: calculerPourcentageDans5M(ligne.maintenance) },
          { cause: 'Qualité', quantite: ligne.qualite, pourcentage5M: calculerPourcentageDans5M(ligne.qualite) },
          { cause: 'Environnement', quantite: ligne.environnement, pourcentage5M: calculerPourcentageDans5M(ligne.environnement) } // ✅ AJOUTÉ
        ]
      };
    });

    // 6. Trier par pourcentage 5M décroissant
    resultats.sort((a, b) => b.pourcentage5M - a.pourcentage5M);

    // 7. Calculer les totaux globaux
    const totalGlobal = {
      totalQtePlanifiee: resultats.reduce((sum, ligne) => sum + ligne.totalQtePlanifiee, 0),
      total5M: resultats.reduce((sum, ligne) => sum + ligne.total5M, 0),
      pourcentage5MGlobal: 0
    };
    
    totalGlobal.pourcentage5MGlobal = calculerPourcentage(
      totalGlobal.total5M, 
      totalGlobal.totalQtePlanifiee
    );

    // 8. Préparer la réponse
    const response = {
      message: `Pourcentages 5M par ligne pour la semaine ${semaine}`,
      periode: {
        semaine: semaine,
        dateCalcul: new Date().toISOString(),
        nombreTotalPlanifications: planifications.length,
        nombreLignes: resultats.length
      },
      resumeGlobal: {
        totalQtePlanifiee: totalGlobal.totalQtePlanifiee,
        total5M: totalGlobal.total5M,
        pourcentage5MGlobal: totalGlobal.pourcentage5MGlobal
      },
      lignes: resultats,
      // Pour faciliter la génération de graphiques
      resumePourGraphique: {
        labels: resultats.map(l => l.ligne),
        pourcentages: resultats.map(l => l.pourcentage5M),
        totaux: resultats.map(l => l.total5M)
      }
    };

    console.log(`=== FIN POURCENTAGE 5M PAR LIGNE POUR SEMAINE ${semaine} ===`);
    return response;

  } catch (error) {
    console.error(`Erreur dans getPourcentage5MParLigne:`, error);
    
    if (error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des pourcentages 5M par ligne: ${error.message}`
    );
  }
}
async getStatsParDate(getStatsDateDto: GetStatsDateDto) {
  const { date } = getStatsDateDto;
  
  console.log(`=== CALCUL STATS POUR LA DATE ${date} ===`);

  try {
    // 1. Convertir la date en semaine et jour
    const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
    
    console.log(`Date ${date} convertie en: semaine="${semaine}", jour="${jour}"`);

    // 2. Récupérer les stats de production par ligne (MAINTENANT séparées en actives/non actives)
    const statsProduction = await this.getProductionParLigneDate(semaine, jour);

    // 3. Récupérer les stats de saisie des rapports
    const statsRapports = await this.getRapportsSaisieStats(semaine, jour);

    // 4. Calculer le PCS TOTAL pour toutes les lignes
    const totalQteSource = statsProduction.totalQteSource;
    const totalDecProduction = statsProduction.totalDecProduction;
    
    const pcsTotalToutesLignes = totalQteSource > 0 
      ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100
      : 0;

    // 5. Préparer la réponse complète avec séparation lignes actives/non actives
    const response = {
      message: `Statistiques complètes pour le ${date}`,
      periode: {
        date: date,
        jour: jour,
        semaine: semaine,
        dateCalcul: new Date().toISOString()
      },
      // ✅ MODIFICATION : Séparation des lignes
      lignesActives: statsProduction.lignesActives,
      lignesNonActives: statsProduction.lignesNonActives,
      resumeProduction: {
        nombreLignes: statsProduction.nombreLignes,
        nombreLignesActives: statsProduction.nombreLignesActives,  // ✅ NOUVEAU
        nombreLignesNonActives: statsProduction.nombreLignesNonActives,  // ✅ NOUVEAU
        totalQteSource: totalQteSource,
        totalDecProduction: totalDecProduction,
        // ✅ AJOUTÉ : PCS total toutes lignes confondues
        pcsTotalToutesLignes: pcsTotalToutesLignes,
        pcsProdMoyen: statsProduction.pcsProdMoyen,
        total5M: statsProduction.total5M,
        pourcentage5MMoyen: statsProduction.pourcentage5MMoyen
      },
      rapportsSaisie: statsRapports
    };

    console.log(`=== FIN CALCUL STATS POUR ${date} ===`);
    console.log(`Lignes actives: ${statsProduction.nombreLignesActives}, Non actives: ${statsProduction.nombreLignesNonActives}`);
    console.log(`PCS total toutes lignes: ${pcsTotalToutesLignes}%`);
    
    return response;

  } catch (error) {
    console.error(`Erreur dans getStatsParDate:`, error);
    
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des statistiques pour la date ${date}: ${error.message}`
    );
  }
}

  /**
   * ✅ NOUVELLE MÉTHODE : Stats de production par ligne pour une date
   */
 private async getProductionParLigneDate(semaine: string, jour: string) {
  // Récupérer toutes les planifications pour ce jour
  const planifications = await this.planificationRepository.find({
    where: { semaine, jour },
    relations: ['nonConformites'],
    order: { ligne: 'ASC' }
  });

  if (planifications.length === 0) {
    throw new NotFoundException(
      `Aucune planification trouvée pour le ${jour} de la semaine ${semaine}`
    );
  }

  // Grouper par ligne
  const statsParLigne: Record<string, any> = {};

  for (const plan of planifications) {
    const ligne = plan.ligne;
    const quantiteSource = this.getQuantitySource(plan);

    if (!statsParLigne[ligne]) {
      statsParLigne[ligne] = {
        ligne: ligne,
        totalQtePlanifiee: 0,  // ✅ NOUVEAU : Pour déterminer si la ligne est active
        totalQteSource: 0,
        totalDecProduction: 0,
        total5M: 0,
        nombreReferences: new Set<string>(),
        nombrePlanifications: 0,
        references: []
      };
    }

    const ligneStats = statsParLigne[ligne];
    ligneStats.totalQtePlanifiee += plan.qtePlanifiee;  // ✅ NOUVEAU
    ligneStats.totalQteSource += quantiteSource;
    ligneStats.totalDecProduction += plan.decProduction;
    ligneStats.nombrePlanifications += 1;
    ligneStats.nombreReferences.add(plan.reference);

    // Ajouter les détails de la référence
    ligneStats.references.push({
      reference: plan.reference,
      of: plan.of,
      qtePlanifiee: plan.qtePlanifiee,
      qteModifiee: plan.qteModifiee,
      qteSource: quantiteSource,
      decProduction: plan.decProduction,
      pcsProd: plan.pcsProd
    });

    // Traiter les non-conformités
    if (plan.nonConformites && plan.nonConformites.length > 0) {
      const nonConf = plan.nonConformites[0];
      ligneStats.total5M += nonConf.total;
    }
  }

  // ✅ NOUVEAU : Séparer les lignes actives et non actives
  const lignesActives: any[] = [];
  const lignesNonActives: any[] = [];

  Object.values(statsParLigne).forEach((ligne: any) => {
    // Calculer les pourcentages
    const pcsProd = ligne.totalQteSource > 0 
      ? (ligne.totalDecProduction / ligne.totalQteSource) * 100 
      : 0;
    
    const pourcentage5M = ligne.totalQteSource > 0
      ? (ligne.total5M / ligne.totalQteSource) * 100
      : 0;

    const ligneFormatee = {
      ligne: ligne.ligne,
      actif: ligne.totalQtePlanifiee > 0,  // ✅ Déterminer si actif
      totalQtePlanifiee: ligne.totalQtePlanifiee,  // ✅ NOUVEAU
      nombrePlanifications: ligne.nombrePlanifications,
      nombreReferences: ligne.nombreReferences.size,
      totalQteSource: ligne.totalQteSource,
      totalDecProduction: ligne.totalDecProduction,
      pcsProdTotal: Math.round(pcsProd * 100) / 100,
      total5M: ligne.total5M,
      pourcentage5M: Math.round(pourcentage5M * 10) / 10,
      references: ligne.references
    };

    // Séparer selon le critère d'activité
    if (ligne.totalQtePlanifiee > 0) {
      lignesActives.push(ligneFormatee);
    } else {
      lignesNonActives.push(ligneFormatee);
    }
  });

  // Calculer les totaux globaux (toutes lignes confondues)
  const toutesLignes = [...lignesActives, ...lignesNonActives];
  const totalQteSource = toutesLignes.reduce((sum, l) => sum + l.totalQteSource, 0);
  const totalDecProduction = toutesLignes.reduce((sum, l) => sum + l.totalDecProduction, 0);
  const total5M = toutesLignes.reduce((sum, l) => sum + l.total5M, 0);
  
  const pcsProdMoyen = totalQteSource > 0 
    ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100
    : 0;
  
  const pourcentage5MMoyen = totalQteSource > 0
    ? Math.round((total5M / totalQteSource) * 100 * 10) / 10
    : 0;

  return {
    nombreLignes: toutesLignes.length,
    nombreLignesActives: lignesActives.length,  // ✅ NOUVEAU
    nombreLignesNonActives: lignesNonActives.length,  // ✅ NOUVEAU
    totalQteSource,
    totalDecProduction,
    pcsProdMoyen,
    total5M,
    pourcentage5MMoyen,
    lignesActives,  // ✅ NOUVEAU : Tableau séparé
    lignesNonActives  // ✅ NOUVEAU : Tableau séparé
  };
}

  /**
   * ✅ NOUVELLE MÉTHODE : Stats des rapports de saisie
   */
  private async getRapportsSaisieStats(semaine: string, jour: string) {
    // 1. Récupérer tous les rapports pour ce jour
    const rapports = await this.saisieRapportRepository.find({
      where: { semaine, jour },
      order: { ligne: 'ASC', matricule: 'ASC' }
    });

    // 2. Récupérer le nombre total d'ouvriers
    const totalOuvriers = await this.ouvrierRepository.count();

    // 3. Extraire les matricules ayant saisi
    const matriculesAyantSaisi = new Set(rapports.map(r => r.matricule));
    const nombreRapportsSaisis = matriculesAyantSaisi.size;

    // 4. Récupérer tous les ouvriers
    const tousLesOuvriers = await this.ouvrierRepository.find({
      order: { matricule: 'ASC' }
    });

    // 5. Identifier les ouvriers n'ayant pas saisi
    const ouvriersNonSaisis = tousLesOuvriers.filter(
      ouvrier => !matriculesAyantSaisi.has(ouvrier.matricule)
    ).map(ouvrier => ({
      matricule: ouvrier.matricule,
      nomPrenom: ouvrier.nomPrenom
    }));

    // 6. Liste des ouvriers ayant saisi avec leurs détails
    const ouvriersAyantSaisi = rapports.map(rapport => ({
      matricule: rapport.matricule,
      nomPrenom: rapport.nomPrenom,
      ligne: rapport.ligne,
      totalHeures: rapport.totalHeuresJour,
      nbPhases: rapport.nbPhasesJour,
      phases: rapport.phases
    }));

    // 7. Stats par ligne
    const statsParLigne: Record<string, any> = {};
    rapports.forEach(rapport => {
      if (!statsParLigne[rapport.ligne]) {
        statsParLigne[rapport.ligne] = {
          nombreOuvriers: 0,
          totalHeures: 0,
          ouvriers: []
        };
      }
      statsParLigne[rapport.ligne].nombreOuvriers++;
      statsParLigne[rapport.ligne].totalHeures += rapport.totalHeuresJour;
      statsParLigne[rapport.ligne].ouvriers.push({
        matricule: rapport.matricule,
        nomPrenom: rapport.nomPrenom,
        heures: rapport.totalHeuresJour
      });
    });

    // 8. Calculer le taux de saisie
    const tauxSaisie = totalOuvriers > 0 
      ? Math.round((nombreRapportsSaisis / totalOuvriers) * 100 * 10) / 10
      : 0;

    return {
      nombreRapportsSaisis: nombreRapportsSaisis,
      nombreTotalRapports: rapports.length,
      nombreOuvriersTotal: totalOuvriers,
      nombreOuvriersNonSaisis: ouvriersNonSaisis.length,
      tauxSaisie: tauxSaisie,
      ouvriersNonSaisis: ouvriersNonSaisis,
      ouvriersAyantSaisi: ouvriersAyantSaisi,
      repartitionParLigne: statsParLigne
    };
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Obtenir uniquement les stats de saisie pour une date
   */
   async getRapportsSaisieParDate(getStatsDateDto: GetStatsDateDto) {
    const { date } = getStatsDateDto;
    
    console.log(`=== CALCUL RAPPORTS SAISIE POUR ${date} ===`);

    try {
      // Convertir la date en semaine et jour
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
      
      console.log(`Date ${date} convertie en: semaine=${semaine}, jour=${jour}`);

      const statsRapports = await this.getRapportsSaisieStats(semaine, jour);

      return {
        message: `Statistiques de saisie pour le ${date}`,
        periode: {
          date: date,
          jour: jour,
          semaine: semaine,
          dateCalcul: new Date().toISOString()
        },
        ...statsRapports
      };

    } catch (error) {
      console.error(`Erreur dans getRapportsSaisieParDate:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors du calcul des rapports de saisie: ${error.message}`
      );
    }
  }

  private async mettreAJourStatutsAutomatiques(semaine: string, jour: string, date: string) {
  // Récupérer tous les ouvriers qui ont saisi
  const rapports = await this.saisieRapportRepository.find({
    where: { semaine, jour }
  });

  // Pour chaque ouvrier ayant saisi, mettre à jour statut à 'P'
  for (const rapport of rapports) {
    await this.statutOuvrierRepository.upsert(
      {
        matricule: rapport.matricule,
        nomPrenom: rapport.nomPrenom,
        date: date,
        statut: 'P'
      },
      ['matricule', 'date'] // Clé unique : matricule + date
    );
  }
}

async getOuvriersNonSaisisParDate(date: string) {
  console.log(`=== OBTENIR OUVRIERS NON-SAISIS POUR ${date} ===`);

  try {
    // 1. Convertir la date en semaine et jour
    const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
    
    // 2. Récupérer tous les rapports saisis ce jour
    const rapports = await this.saisieRapportRepository.find({
      where: { semaine, jour }
    });
    const matriculesAyantSaisi = new Set(rapports.map(r => r.matricule));

    // 3. Récupérer tous les ouvriers
    const tousLesOuvriers = await this.ouvrierRepository.find({
      order: { matricule: 'ASC' }
    });

    // 4. Filtrer les ouvriers non-saisis
    const ouvriersNonSaisis = tousLesOuvriers.filter(
      ouvrier => !matriculesAyantSaisi.has(ouvrier.matricule)
    );

    // 5. Récupérer les statuts existants (AB, C, S) depuis la table statuts
    const matriculesNonSaisis = ouvriersNonSaisis.map(o => o.matricule);
    const statutsExistants = await this.statutOuvrierRepository.find({
      where: {
        matricule: In(matriculesNonSaisis),
        date: date
      }
    });

    // Créer une map pour accès rapide
    const statutMap = new Map();
    statutsExistants.forEach(statut => {
      statutMap.set(statut.matricule, statut.statut);
    });

    // 6. Préparer la réponse
    const ouvriersFormates = ouvriersNonSaisis.map(ouvrier => {
      const statut = statutMap.get(ouvrier.matricule) || null;
      
      return {
        matricule: ouvrier.matricule,
        nomPrenom: ouvrier.nomPrenom,
        statut: statut, // null si pas encore défini, sinon AB/C/S
        aSaisi: false,
        date: date,
        semaine: semaine,
        jour: jour,
        // Suggestions pour l'interface frontend :
        statutOptions: [
          { code: 'AB', libelle: 'Absent' },
          { code: 'C', libelle: 'Congé' },
          { code: 'S', libelle: 'Sélection' }
        ]
      };
    });

    return {
      message: `Ouvriers non-saisis pour le ${date}`,
      date: date,
      jour: jour,
      semaine: semaine,
      nombreTotalOuvriers: tousLesOuvriers.length,
      nombreOuvriersSaisis: matriculesAyantSaisi.size,
      nombreOuvriersNonSaisis: ouvriersNonSaisis.length,
      ouvriers: ouvriersFormates
    };

  } catch (error) {
    console.error(`Erreur dans getOuvriersNonSaisisParDate:`, error);
    throw new InternalServerErrorException(
      `Erreur lors de la récupération des ouvriers non-saisis: ${error.message}`
    );
  }
}

  /**
   * Méthode utilitaire (déjà existante dans votre code)
   */
private convertirDateEnSemaineEtJour(dateStr: string): { semaine: string; jour: string } {
  try {
    const date = new Date(dateStr);
    
    // Vérifier si la date est valide
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Date invalide: ${dateStr}`);
    }

    // 1. CALCULER LE NUMÉRO DE SEMAINE (ISO)
    // Méthode standard pour calculer la semaine ISO
    const getISOWeeks = (d: Date) => {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7; // Lundi = 0, Dimanche = 6
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    };

    const numeroSemaine = getISOWeeks(date);
    
    // 2. FORMATER LA SEMAINE COMME DANS VOTRE BASE : "semaine5"
    const semaine = `semaine${numeroSemaine}`;
    
    // 3. FORMATER LE JOUR EN MINUSCULE COMME DANS VOTRE BASE : "lundi"
    const joursMap = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const jour = joursMap[date.getDay()];

    console.log(`[CONVERSION DATE] ${dateStr} → semaine: "${semaine}", jour: "${jour}"`);
    
    return { 
      semaine,  // "semaine5" 
      jour      // "lundi"
    };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException(`Erreur lors de la conversion de la date: ${error.message}`);
  }
}
/**
   * ✅ NOUVELLE MÉTHODE CORRIGÉE : Obtenir les stats PCS par mois pour toutes les lignes d'une année
   * L'utilisateur envoie une date et on calcule pour toute l'année
   */
  async getStatsPcsParMoisEtLigne(getStatsAnnuelDto: { date: string }) {
    const { date } = getStatsAnnuelDto;
    
    console.log(`=== CALCUL PCS PAR MOIS ET LIGNE POUR ${date} ===`);

    try {
      // 1. Extraire l'année de la date
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new BadRequestException(`Date invalide: ${date}`);
      }
      
      const annee = dateObj.getFullYear();
      console.log(`Année extraite: ${annee}`);

      // 2. Définir les 12 mois
      const moisNoms = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
      ];

      // 3. Récupérer TOUTES les semaines de l'année
      // On filtre par dateDebut qui contient l'année
      const debutAnnee = new Date(`${annee}-01-01`);
      const finAnnee = new Date(`${annee}-12-31`);
      
      const semaines = await this.semaineRepository.find({
        where: {
          dateDebut: MoreThanOrEqual(debutAnnee) && LessThanOrEqual(finAnnee)
        }
      });

      if (semaines.length === 0) {
        throw new NotFoundException(
          `Aucune semaine trouvée pour l'année ${annee}`
        );
      }

      const nomsSemainesAnnee = semaines.map(s => s.nom);
      console.log(`Semaines trouvées: ${nomsSemainesAnnee.join(', ')}`);

      // 4. Récupérer toutes les planifications de ces semaines
      const planifications = await this.planificationRepository.find({
        where: nomsSemainesAnnee.map(semaine => ({ semaine })),
        order: { ligne: 'ASC', semaine: 'ASC' }
      });

      if (planifications.length === 0) {
        throw new NotFoundException(
          `Aucune planification trouvée pour l'année ${annee}`
        );
      }

      console.log(`Nombre total de planifications: ${planifications.length}`);

      // 5. Créer une map: semaine -> mois (1-12)
      const semaineVsMois: Record<string, number> = {};
      semaines.forEach(semaine => {
        // dateDebut est un objet Date, on doit l'extraire
        const dateDebut = semaine.dateDebut instanceof Date 
          ? semaine.dateDebut 
          : new Date(semaine.dateDebut);
        
        // Extraire le mois (1-12)
        const moisNum = dateDebut.getMonth() + 1; // getMonth() retourne 0-11, on ajoute 1
        semaineVsMois[semaine.nom] = moisNum;
      });

      // 6. Grouper par ligne et par mois
      const statsParLigneEtMois: Record<string, Record<number, {
        totalQteSource: number;
        totalDecProduction: number;
      }>> = {};

      planifications.forEach(plan => {
        const ligne = plan.ligne;
        const moisNum = semaineVsMois[plan.semaine];
        
        if (!moisNum) {
          console.warn(`Semaine ${plan.semaine} non trouvée dans la map`);
          return;
        }

        // Initialiser la ligne
        if (!statsParLigneEtMois[ligne]) {
          statsParLigneEtMois[ligne] = {};
        }

        // Initialiser le mois pour cette ligne
        if (!statsParLigneEtMois[ligne][moisNum]) {
          statsParLigneEtMois[ligne][moisNum] = {
            totalQteSource: 0,
            totalDecProduction: 0
          };
        }

        // Accumuler les totaux
        const qteSource = this.getQuantitySource(plan);
        statsParLigneEtMois[ligne][moisNum].totalQteSource += qteSource;
        statsParLigneEtMois[ligne][moisNum].totalDecProduction += plan.decProduction;
      });

      // 7. Calculer les PCS et formater la réponse
      const lignesFormatees = Object.entries(statsParLigneEtMois).map(([ligne, moisData]) => {
        // Calculer les stats pour chaque mois
        const moisStats: Record<string, {
          pcsProd: number;
          totalQteSource: number;
          totalDecProduction: number;
        }> = {};

        let totalAnnuelQteSource = 0;
        let totalAnnuelDecProduction = 0;

        // Pour chaque mois (1-12)
        for (let m = 1; m <= 12; m++) {
          const data = moisData[m];
          
          if (data && data.totalQteSource > 0) {
            const pcsProd = (data.totalDecProduction / data.totalQteSource) * 100;
            moisStats[moisNoms[m - 1]] = {
              pcsProd: Math.round(pcsProd * 100) / 100,
              totalQteSource: data.totalQteSource,
              totalDecProduction: data.totalDecProduction
            };
            totalAnnuelQteSource += data.totalQteSource;
            totalAnnuelDecProduction += data.totalDecProduction;
          } else {
            // Mois sans données
            moisStats[moisNoms[m - 1]] = {
              pcsProd: 0,
              totalQteSource: 0,
              totalDecProduction: 0
            };
          }
        }

        // Calculer la moyenne annuelle (productivité globale)
        const moyenneAnnuelle = totalAnnuelQteSource > 0
          ? Math.round((totalAnnuelDecProduction / totalAnnuelQteSource) * 100 * 100) / 100
          : 0;

        return {
          ligne,
          mois: moisStats,
          moyenneAnnuelle,
          totalAnnuelQteSource,
          totalAnnuelDecProduction
        };
      });

      // 8. Trier les lignes par ordre alphabétique
      lignesFormatees.sort((a, b) => a.ligne.localeCompare(b.ligne));

      // 9. Calculer la productivité mensuelle globale (toutes lignes confondues)
      const productiviteMensuelle: Record<string, number> = {};
      for (let m = 1; m <= 12; m++) {
        let totalMoisQteSource = 0;
        let totalMoisDecProduction = 0;

        lignesFormatees.forEach(ligne => {
          const moisNom = moisNoms[m - 1];
          totalMoisQteSource += ligne.mois[moisNom].totalQteSource;
          totalMoisDecProduction += ligne.mois[moisNom].totalDecProduction;
        });

        productiviteMensuelle[moisNoms[m - 1]] = totalMoisQteSource > 0
          ? Math.round((totalMoisDecProduction / totalMoisQteSource) * 100 * 100) / 100
          : 0;
      }

      // 10. Calculer la moyenne annuelle globale
      const totalGlobalQteSource = lignesFormatees.reduce((sum, l) => sum + l.totalAnnuelQteSource, 0);
      const totalGlobalDecProduction = lignesFormatees.reduce((sum, l) => sum + l.totalAnnuelDecProduction, 0);
      const moyenneAnnuelleGlobale = totalGlobalQteSource > 0
        ? Math.round((totalGlobalDecProduction / totalGlobalQteSource) * 100 * 100) / 100
        : 0;

      return {
        message: `Statistiques PCS par mois pour l'année ${annee}`,
        annee,
        dateCalcul: new Date().toISOString(),
        nombreLignes: lignesFormatees.length,
        productiviteMensuelle,
        moyenneAnnuelleGlobale,
        lignes: lignesFormatees
      };

    } catch (error) {
      console.error(`Erreur dans getStatsPcsParMoisEtLigne:`, error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors du calcul des stats PCS par mois: ${error.message}`
      );
    }
  }
  // src/stats/stats.service.ts - Ajouter cette méthode

/**
 * ✅ NOUVELLE MÉTHODE : Obtenir les stats 5M par mois pour toute l'année
 * L'utilisateur envoie une date et on calcule les 5M pour tous les mois de l'année
 */
async getStats5MParMois(getStatsAnnuelDto: { date: string }) {
  const { date } = getStatsAnnuelDto;
  
  console.log(`=== CALCUL 5M PAR MOIS POUR ${date} ===`);

  try {
    // 1. Extraire l'année de la date
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException(`Date invalide: ${date}`);
    }
    
    const annee = dateObj.getFullYear();
    console.log(`Année extraite: ${annee}`);

    // 2. Définir les 12 mois
    const moisNoms = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    // 3. Récupérer TOUTES les semaines de l'année
    const debutAnnee = new Date(`${annee}-01-01`);
    const finAnnee = new Date(`${annee}-12-31`);
    
    const semaines = await this.semaineRepository.find({
      where: {
        dateDebut: MoreThanOrEqual(debutAnnee) && LessThanOrEqual(finAnnee)
      }
    });

    if (semaines.length === 0) {
      throw new NotFoundException(
        `Aucune semaine trouvée pour l'année ${annee}`
      );
    }

    const nomsSemainesAnnee = semaines.map(s => s.nom);
    console.log(`Semaines trouvées: ${nomsSemainesAnnee.join(', ')}`);

    // 4. Récupérer toutes les planifications de ces semaines avec leurs non-conformités
    const planifications = await this.planificationRepository.find({
      where: nomsSemainesAnnee.map(semaine => ({ semaine })),
      relations: ['nonConformites'],
      order: { semaine: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour l'année ${annee}`
      );
    }

    console.log(`Nombre total de planifications: ${planifications.length}`);

    // 5. Créer une map: semaine -> mois (1-12)
    const semaineVsMois: Record<string, number> = {};
    semaines.forEach(semaine => {
      const dateDebut = semaine.dateDebut instanceof Date 
        ? semaine.dateDebut 
        : new Date(semaine.dateDebut);
      
      const moisNum = dateDebut.getMonth() + 1;
      semaineVsMois[semaine.nom] = moisNum;
    });

    // 6. Grouper par mois
    const statsParMois: Record<number, {
      totalQtePlanifiee: number;  // ✅ MODIFICATION
      matierePremiere: number;
      absence: number;
      rendement: number;
       methode: number;
      maintenance: number;
      qualite: number;
      environnement: number;
      total5M: number;
    }> = {};

    // Initialiser tous les mois
    for (let m = 1; m <= 12; m++) {
      statsParMois[m] = {
        totalQtePlanifiee: 0,  // ✅ MODIFICATION
        matierePremiere: 0,
        absence: 0,
        rendement: 0,
        methode: 0,
        maintenance: 0,
        qualite: 0,
        environnement: 0,
        total5M: 0
      };
    }

    // 7. Parcourir toutes les planifications
    planifications.forEach(plan => {
      const moisNum = semaineVsMois[plan.semaine];
      
      if (!moisNum) {
        console.warn(`Semaine ${plan.semaine} non trouvée dans la map`);
        return;
      }

      // ✅ MODIFICATION : Utiliser qtePlanifiee au lieu de quantiteSource
      statsParMois[moisNum].totalQtePlanifiee += plan.qtePlanifiee;

      // Ajouter les non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        statsParMois[moisNum].matierePremiere += nonConf.matierePremiere;
        statsParMois[moisNum].absence += nonConf.absence;
        statsParMois[moisNum].rendement += nonConf.rendement;
        statsParMois[moisNum].methode += nonConf.methode;
        statsParMois[moisNum].maintenance += nonConf.maintenance;
        statsParMois[moisNum].qualite += nonConf.qualite;
        statsParMois[moisNum].environnement += nonConf.environnement;
        statsParMois[moisNum].total5M += nonConf.total;
      }
    });

    // 8. Calculer les pourcentages pour chaque mois
    const moisFormates: Record<string, any> = {};
    let totalAnnuelQtePlanifiee = 0;  // ✅ MODIFICATION
    let totalAnnuel5M = 0;
    let totalAnnuelMatierePremiere = 0;
    let totalAnnuelAbsence = 0;
    let totalAnnuelRendement = 0;
    let totalAnnuelMethode = 0;
    let totalAnnuelMaintenance = 0;
    let totalAnnuelQualite = 0;
    let totalAnnuelEnvironnement = 0;

    for (let m = 1; m <= 12; m++) {
      const moisNom = moisNoms[m - 1];
      const data = statsParMois[m];

      // ✅ MODIFICATION : Calculer les pourcentages par rapport à qtePlanifiee
      const calculerPourcentage = (valeur: number): number => {
        if (data.totalQtePlanifiee <= 0) return 0;
        return Math.round((valeur / data.totalQtePlanifiee) * 100 * 100) / 100;
      };

      moisFormates[moisNom] = {
        totalQtePlanifiee: data.totalQtePlanifiee,  // ✅ MODIFICATION
        total5M: data.total5M,
        pourcentageTotal5M: calculerPourcentage(data.total5M),
        matierePremiere: {
          quantite: data.matierePremiere,
          pourcentage: calculerPourcentage(data.matierePremiere)
        },
        absence: {
          quantite: data.absence,
          pourcentage: calculerPourcentage(data.absence)
        },
        rendement: {
          quantite: data.rendement,
          pourcentage: calculerPourcentage(data.rendement)
        },
        methode: {
          quantite: data.methode,
          pourcentage: calculerPourcentage(data.methode)
        },
        maintenance: {
          quantite: data.maintenance,
          pourcentage: calculerPourcentage(data.maintenance)
        },
        qualite: {
          quantite: data.qualite,
          pourcentage: calculerPourcentage(data.qualite)
        },
        environnement: {
          quantite: data.environnement,
          pourcentage: calculerPourcentage(data.environnement)
        }
      };

      // Accumuler les totaux annuels
      totalAnnuelQtePlanifiee += data.totalQtePlanifiee;  // ✅ MODIFICATION
      totalAnnuel5M += data.total5M;
      totalAnnuelMatierePremiere += data.matierePremiere;
      totalAnnuelAbsence += data.absence;
      totalAnnuelRendement += data.rendement;
      totalAnnuelMethode += data.methode;
      totalAnnuelMaintenance += data.maintenance;
      totalAnnuelQualite += data.qualite;
      totalAnnuelEnvironnement += data.environnement;
    }

    // 9. Calculer les moyennes annuelles
    // ✅ MODIFICATION : Utiliser totalAnnuelQtePlanifiee
    const calculerPourcentageAnnuel = (valeur: number): number => {
      if (totalAnnuelQtePlanifiee <= 0) return 0;
      return Math.round((valeur / totalAnnuelQtePlanifiee) * 100 * 100) / 100;
    };

    const moyennesAnnuelles = {
      totalQtePlanifiee: totalAnnuelQtePlanifiee,  // ✅ MODIFICATION
      total5M: totalAnnuel5M,
      pourcentageTotal5M: calculerPourcentageAnnuel(totalAnnuel5M),
      matierePremiere: {
        quantite: totalAnnuelMatierePremiere,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelMatierePremiere),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelMatierePremiere / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      absence: {
        quantite: totalAnnuelAbsence,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelAbsence),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelAbsence / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      rendement: {
        quantite: totalAnnuelRendement,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelRendement),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelRendement / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      methode: {
        quantite: totalAnnuelMethode,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelMethode),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelMethode / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      maintenance: {
        quantite: totalAnnuelMaintenance,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelMaintenance),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelMaintenance / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      qualite: {
        quantite: totalAnnuelQualite,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelQualite),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelQualite / totalAnnuel5M) * 100 * 100) / 100 : 0
      },
      environnement: {
        quantite: totalAnnuelEnvironnement,
        pourcentage: calculerPourcentageAnnuel(totalAnnuelEnvironnement),
        pourcentageDans5M: totalAnnuel5M > 0 ? Math.round((totalAnnuelEnvironnement / totalAnnuel5M) * 100 * 100) / 100 : 0
      }
    };

    // 10. Préparer les données pour les graphiques
    const donneesGraphiques = {
      // Pour le graphique circulaire (répartition des causes)
      graphiqueCirculaire: {
        labels: ['Matière Première', 'Absence', 'Rendement', 'Méthode', 'Maintenance', 'Qualité', 'Environnement'],
        values: [
          moyennesAnnuelles.matierePremiere.pourcentageDans5M,
          moyennesAnnuelles.absence.pourcentageDans5M,
          moyennesAnnuelles.rendement.pourcentageDans5M,
          moyennesAnnuelles.methode.pourcentageDans5M,
          moyennesAnnuelles.maintenance.pourcentageDans5M,
          moyennesAnnuelles.qualite.pourcentageDans5M,
          moyennesAnnuelles.environnement.pourcentageDans5M
        ]
      },
      // Pour le graphique en barres (% général arrêt par mois)
      graphiqueBarres: {
        labels: moisNoms,
        values: moisNoms.map(mois => moisFormates[mois].pourcentageTotal5M)
      }
    };

    // 11. Tableau récapitulatif
    const tableauRecapitulatif = moisNoms.map(mois => ({
      mois: mois,
      matierePremiere: moisFormates[mois].matierePremiere.pourcentage,
      absence: moisFormates[mois].absence.pourcentage,
      rendement: moisFormates[mois].rendement.pourcentage,
      methode: moisFormates[mois].methode.pourcentage,
      maintenance: moisFormates[mois].maintenance.pourcentage,
      qualite: moisFormates[mois].qualite.pourcentage,
      environnement: moisFormates[mois].environnement.pourcentage,
      total5M: moisFormates[mois].pourcentageTotal5M
    }));

    console.log(`=== FIN CALCUL 5M PAR MOIS POUR ${date} ===`);

    return {
      message: `Statistiques 5M par mois pour l'année ${annee}`,
      annee,
      dateCalcul: new Date().toISOString(),
      mois: moisFormates,
      moyennesAnnuelles,
      donneesGraphiques,
      tableauRecapitulatif
    };

  } catch (error) {
    console.error(`Erreur dans getStats5MParMois:`, error);
    
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des stats 5M par mois: ${error.message}`
    );
  }
}
async getAffectationPersonnel(semaine: string) {
  try {
    console.log(`=== CALCUL AFFECTATION PERSONNEL POUR ${semaine} ===`);

    // 1. Récupérer toutes les planifications pour cette semaine avec agrégation par ligne/jour
    const planificationsAgregees = await this.planificationRepository
      .createQueryBuilder('plan')
      .select('plan.ligne', 'ligne')
      .addSelect('plan.jour', 'jour')
      .addSelect('SUM(plan.nbOperateurs)', 'totalNbOperateurs')
      .where('plan.semaine = :semaine', { semaine })
      .groupBy('plan.ligne')
      .addGroupBy('plan.jour')
      .getRawMany();

    if (planificationsAgregees.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour la semaine ${semaine}`
      );
    }

    console.log(`Planifications agrégées trouvées: ${planificationsAgregees.length}`);

    // 2. Créer une map pour accès rapide aux planifications
    const planifMap = new Map<string, number>();
    planificationsAgregees.forEach(p => {
      const key = `${p.ligne}-${p.jour}`;
      // Arrondir le total des nbOperateurs
      const nbOp = Math.round((parseFloat(p.totalNbOperateurs) || 0) * 10) / 10; 
      planifMap.set(key, nbOp);
      console.log(`  ${key}: ${nbOp} opérateurs planifiés`);
    });

    // 3. Récupérer toutes les saisies de rapport pour cette semaine
    const saisies = await this.saisieRapportRepository
      .createQueryBuilder('saisie')
      .select('saisie.ligne', 'ligne')
      .addSelect('saisie.jour', 'jour')
      .addSelect('COUNT(DISTINCT saisie.matricule)', 'nbOperateurs')
      .where('saisie.semaine = :semaine', { semaine })
      .groupBy('saisie.ligne')
      .addGroupBy('saisie.jour')
      .getRawMany();

    console.log(`Saisies trouvées: ${saisies.length}`);

    // 4. Créer une map pour accès rapide aux saisies
    const saisiesMap = new Map<string, number>();
    saisies.forEach(s => {
      const key = `${s.ligne}-${s.jour}`;
      const nbOp = parseInt(s.nbOperateurs);
      saisiesMap.set(key, nbOp);
      console.log(`  ${key}: ${nbOp} opérateurs ont saisi`);
    });

    // 5. Obtenir toutes les lignes uniques
    const lignesUniques = new Set<string>();
    planificationsAgregees.forEach(p => lignesUniques.add(p.ligne));

    // 6. Pour chaque ligne, calculer les stats par jour
    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const lignes: any[] = [];
    
    lignesUniques.forEach(ligne => {
      const joursData: any[] = [];
      
      jours.forEach(jour => {
        const key = `${ligne}-${jour}`;
        
        // Récupérer le nombre d'opérateurs planifiés (somme des nbOperateurs)
        const nbPlanifie = planifMap.get(key) || 0;
        
        // Récupérer le nombre d'opérateurs qui ont saisi
        const nbSaisi = saisiesMap.get(key) || 0;
        
        // Calculer la différence
        const difference = nbSaisi - nbPlanifie;
        
        // Déterminer le statut et le message
        let statut: string;
        let message: string;
        
        if (difference === 0) {
          statut = 'CONFORME';
          message = 'Bon';
        } else if (difference > 0) {
          statut = 'NON_CONFORME';
          message = `Non-conformité : +${difference} opérateur${difference > 1 ? 's' : ''}`;
        } else {
          statut = 'NON_CONFORME';
          message = `Non-conformité : ${difference} opérateur${Math.abs(difference) > 1 ? 's' : ''}`;
        }
        
        // Ajouter les données du jour
        joursData.push({
          jour,
          nbPlanifie,
          nbSaisi,
          difference,
          statut,
          message
        });
      });
      
      lignes.push({
        ligne,
        jours: joursData
      });
    });

    // 7. Calculer les statistiques globales
    let totalPlanifie = 0;
    let totalSaisi = 0;
    let nbNonConformites = 0;
    
    lignes.forEach(ligne => {
      ligne.jours.forEach((jour: any) => {
        totalPlanifie += jour.nbPlanifie;
        totalSaisi += jour.nbSaisi;
        if (jour.statut === 'NON_CONFORME') {
          nbNonConformites++;
        }
      });
    });

    const tauxConformite = totalPlanifie > 0 
      ? Math.round(((totalPlanifie - Math.abs(totalSaisi - totalPlanifie)) / totalPlanifie) * 100 * 100) / 100
      : 0;

    console.log(`=== FIN CALCUL AFFECTATION PERSONNEL ===`);
    console.log(`Total planifié: ${totalPlanifie}, Total saisi: ${totalSaisi}`);
    console.log(`Non-conformités: ${nbNonConformites}`);

    return {
      message: `Affectation du personnel pour la semaine ${semaine}`,
      semaine,
      dateCalcul: new Date().toISOString(),
      statistiquesGlobales: {
        totalPlanifie,
        totalSaisi,
        difference: totalSaisi - totalPlanifie,
        nbNonConformites,
        tauxConformite: `${tauxConformite}%`
      },
      lignes
    };

  } catch (error) {
    console.error(`Erreur dans getAffectationPersonnel:`, error);
    
    if (error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul de l'affectation du personnel: ${error.message}`
    );
  }
}

// À AJOUTER dans stats.service.ts



// ... dans la classe StatsService ...

/**
 * ✅ NOUVELLE MÉTHODE : Obtenir les stats 5M par ligne pour une date donnée
 * Affiche chaque ligne avec ses références et les 5M de chaque référence
 */
async getStats5MParDate(getStats5MDateDto: GetStats5MDateDto) {
  const { date } = getStats5MDateDto;
  
  console.log(`=== CALCUL 5M PAR LIGNE POUR LA DATE ${date} ===`);

  try {
    // 1. Convertir la date en semaine et jour
    const { semaine, jour } = this.convertirDateEnSemaineEtJour(date);
    
    console.log(`Date ${date} convertie en: semaine="${semaine}", jour="${jour}"`);

    // 2. Récupérer toutes les planifications pour ce jour
    const planifications = await this.planificationRepository.find({
      where: { semaine, jour },
      relations: ['nonConformites'],
      order: { ligne: 'ASC', reference: 'ASC' }
    });

    if (planifications.length === 0) {
      throw new NotFoundException(
        `Aucune planification trouvée pour le ${jour} de la semaine ${semaine} (${date})`
      );
    }

    console.log(`Nombre de planifications trouvées: ${planifications.length}`);

    // 3. Grouper par ligne
    const statsParLigne: Record<string, {
      ligne: string;
      totalQtePlanifiee: number;  // ✅ MODIFICATION
      total5M: number;
      totalMatierePremiere: number;
      totalAbsence: number;
      totalRendement: number;
      totalMethode: number;
      totalMaintenance: number;
      totalQualite: number;
      totalEnvironnement: number; // ✅ AJOUTÉ
      references: any[];
    }> = {};

    // 4. Parcourir toutes les planifications
    for (const plan of planifications) {
      const ligne = plan.ligne;

      // Initialiser la ligne si elle n'existe pas
      if (!statsParLigne[ligne]) {
        statsParLigne[ligne] = {
          ligne: ligne,
          totalQtePlanifiee: 0,  // ✅ MODIFICATION
          total5M: 0,
          totalMatierePremiere: 0,
          totalAbsence: 0,
          totalRendement: 0,
          totalMethode: 0,
          totalMaintenance: 0,
          totalQualite: 0,
          totalEnvironnement: 0, // ✅ AJOUTÉ
          references: []
        };
      }

      const ligneStats = statsParLigne[ligne];
      ligneStats.totalQtePlanifiee += plan.qtePlanifiee;  // ✅ MODIFICATION

      // Préparer les données de la référence
      const quantiteSource = this.getQuantitySource(plan);
      const referenceData: any = {
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        qteSource: quantiteSource,
        decProduction: plan.decProduction,
        pcsProd: plan.pcsProd,
        nonConformite: null
      };

      // Traiter les non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        // Accumuler les totaux de la ligne
        ligneStats.total5M += nonConf.total;
        ligneStats.totalMatierePremiere += nonConf.matierePremiere;
        ligneStats.totalAbsence += nonConf.absence;
        ligneStats.totalRendement += nonConf.rendement;
        ligneStats.totalMethode += nonConf.methode;
        ligneStats.totalMaintenance += nonConf.maintenance;
        ligneStats.totalQualite += nonConf.qualite;
        ligneStats.totalEnvironnement += nonConf.environnement; // ✅ AJOUTÉ

        // ✅ MODIFICATION : Calculer les pourcentages basés sur qtePlanifiee
        const calculerPourcentageRef = (valeur: number): number => {
          if (plan.qtePlanifiee <= 0) return 0;
          return Math.round((valeur / plan.qtePlanifiee) * 100 * 10) / 10;
        };

        referenceData.nonConformite = {
          matierePremiere: {
            quantite: nonConf.matierePremiere,
            pourcentage: calculerPourcentageRef(nonConf.matierePremiere),
            reference: nonConf.referenceMatierePremiere || null
          },
          absence: {
            quantite: nonConf.absence,
            pourcentage: calculerPourcentageRef(nonConf.absence)
          },
          rendement: {
            quantite: nonConf.rendement,
            pourcentage: calculerPourcentageRef(nonConf.rendement)
          },
          methode: {
            quantite: nonConf.methode,
  pourcentage: calculerPourcentageRef(nonConf.methode)
},
          maintenance: {
            quantite: nonConf.maintenance,
            pourcentage: calculerPourcentageRef(nonConf.maintenance)
          },
          qualite: {
            quantite: nonConf.qualite,
            pourcentage: calculerPourcentageRef(nonConf.qualite)
          },
          environnement: {  // ✅ AJOUTÉ
            quantite: nonConf.environnement,
            pourcentage: calculerPourcentageRef(nonConf.environnement)
          },
          total5M: {
            quantite: nonConf.total,
            pourcentage: calculerPourcentageRef(nonConf.total)
          },
          commentaire: nonConf.commentaire || null
        };
      } else {
        // Pas de non-conformité pour cette référence
        referenceData.nonConformite = {
          matierePremiere: { quantite: 0, pourcentage: 0, reference: null },
          absence: { quantite: 0, pourcentage: 0 },
          rendement: { quantite: 0, pourcentage: 0 },
          maintenance: { quantite: 0, pourcentage: 0 },
          methode: { quantite: 0, pourcentage: 0 },
          qualite: { quantite: 0, pourcentage: 0 },
          environnement: { quantite: 0, pourcentage: 0 }, // ✅ AJOUTÉ
          total5M: { quantite: 0, pourcentage: 0 },
          commentaire: null
        };
      }

      // Ajouter la référence à la ligne
      ligneStats.references.push(referenceData);
    }

    // 5. Calculer les pourcentages globaux pour chaque ligne
    const lignesFormatees = Object.values(statsParLigne).map(ligne => {
      // ✅ MODIFICATION : Utiliser totalQtePlanifiee
      const calculerPourcentageLigne = (valeur: number): number => {
        if (ligne.totalQtePlanifiee <= 0) return 0;
        return Math.round((valeur / ligne.totalQtePlanifiee) * 100 * 10) / 10;
      };

      // Calculer aussi le pourcentage de chaque cause dans le total 5M
      const calculerPourcentageDans5M = (valeur: number): number => {
        if (ligne.total5M <= 0) return 0;
        return Math.round((valeur / ligne.total5M) * 100 * 10) / 10;
      };

      return {
        ligne: ligne.ligne,
        nombreReferences: ligne.references.length,
        totalQtePlanifiee: ligne.totalQtePlanifiee,  // ✅ MODIFICATION
        total5M: ligne.total5M,
        pourcentage5M: calculerPourcentageLigne(ligne.total5M),
        detailTotalParCause: {
          matierePremiere: {
            quantite: ligne.totalMatierePremiere,
            pourcentageSource: calculerPourcentageLigne(ligne.totalMatierePremiere),
            pourcentageDans5M: calculerPourcentageDans5M(ligne.totalMatierePremiere)
          },
          absence: {
            quantite: ligne.totalAbsence,
            pourcentageSource: calculerPourcentageLigne(ligne.totalAbsence),
            pourcentageDans5M: calculerPourcentageDans5M(ligne.totalAbsence)
          },
          rendement: {
            quantite: ligne.totalRendement,
            pourcentageSource: calculerPourcentageLigne(ligne.totalRendement),
            pourcentageDans5M: calculerPourcentageDans5M(ligne.totalRendement)
          },
          methode: {
            quantite: ligne.totalMethode,
            pourcentageSource: calculerPourcentageLigne(ligne.totalMethode),
            pourcentageDans5M: calculerPourcentageDans5M(ligne.totalMethode)
          },
          maintenance: {
            quantite: ligne.totalMaintenance,
            pourcentageSource: calculerPourcentageLigne(ligne.totalMaintenance),
            pourcentageDans5M: calculerPourcentageDans5M(ligne.totalMaintenance)
          },
          qualite: {
            quantite: ligne.totalQualite,
            pourcentageSource: calculerPourcentageLigne(ligne.totalQualite),
            pourcentageDans5M: calculerPourcentageDans5M(ligne.totalQualite)
          },
          environnement: {  // ✅ AJOUTÉ
            quantite: ligne.totalEnvironnement,
            pourcentageSource: calculerPourcentageLigne(ligne.totalEnvironnement),
            pourcentageDans5M: calculerPourcentageDans5M(ligne.totalEnvironnement)
          }
        },
        references: ligne.references
      };
    });

    // 6. Trier par ligne
    lignesFormatees.sort((a, b) => a.ligne.localeCompare(b.ligne));

    // 7. Calculer les totaux globaux du jour (toutes lignes confondues)
    // ✅ MODIFICATION : Utiliser totalQtePlanifiee
    const totalGlobal = {
      totalQtePlanifiee: lignesFormatees.reduce((sum, l) => sum + l.totalQtePlanifiee, 0),
      total5M: lignesFormatees.reduce((sum, l) => sum + l.total5M, 0),
      totalMatierePremiere: Object.values(statsParLigne).reduce((sum, l) => sum + l.totalMatierePremiere, 0),
      totalAbsence: Object.values(statsParLigne).reduce((sum, l) => sum + l.totalAbsence, 0),
      totalRendement: Object.values(statsParLigne).reduce((sum, l) => sum + l.totalRendement, 0),
      totalMethode: Object.values(statsParLigne).reduce((sum, l) => sum + l.totalMethode, 0),
      totalMaintenance: Object.values(statsParLigne).reduce((sum, l) => sum + l.totalMaintenance, 0),
      totalQualite: Object.values(statsParLigne).reduce((sum, l) => sum + l.totalQualite, 0),
      totalEnvironnement: Object.values(statsParLigne).reduce((sum, l) => sum + l.totalEnvironnement, 0) // ✅ AJOUTÉ
    };

    // Calculer les pourcentages globaux
    const calculerPourcentageGlobal = (valeur: number): number => {
      if (totalGlobal.totalQtePlanifiee <= 0) return 0;  // ✅ MODIFICATION
      return Math.round((valeur / totalGlobal.totalQtePlanifiee) * 100 * 10) / 10;
    };

    const calculerPourcentageDans5MGlobal = (valeur: number): number => {
      if (totalGlobal.total5M <= 0) return 0;
      return Math.round((valeur / totalGlobal.total5M) * 100 * 10) / 10;
    };

    const pourcentage5MGlobal = calculerPourcentageGlobal(totalGlobal.total5M);

    // 8. Créer le résumé total du jour avec détail par cause
    const resumeTotalJour = {
      totalQtePlanifiee: totalGlobal.totalQtePlanifiee,  // ✅ MODIFICATION
      total5M: totalGlobal.total5M,
      pourcentage5M: pourcentage5MGlobal,
      detailParCause: {
        matierePremiere: {
          quantite: totalGlobal.totalMatierePremiere,
          pourcentageSource: calculerPourcentageGlobal(totalGlobal.totalMatierePremiere),
          pourcentageDans5M: calculerPourcentageDans5MGlobal(totalGlobal.totalMatierePremiere)
        },
        absence: {
          quantite: totalGlobal.totalAbsence,
          pourcentageSource: calculerPourcentageGlobal(totalGlobal.totalAbsence),
          pourcentageDans5M: calculerPourcentageDans5MGlobal(totalGlobal.totalAbsence)
        },
        rendement: {
          quantite: totalGlobal.totalRendement,
          pourcentageSource: calculerPourcentageGlobal(totalGlobal.totalRendement),
          pourcentageDans5M: calculerPourcentageDans5MGlobal(totalGlobal.totalRendement)
        },
        methode: {
          quantite: totalGlobal.totalMethode,
          pourcentageSource: calculerPourcentageGlobal(totalGlobal.totalMethode),
          pourcentageDans5M: calculerPourcentageDans5MGlobal(totalGlobal.totalMethode)
        },
        maintenance: {
          quantite: totalGlobal.totalMaintenance,
          pourcentageSource: calculerPourcentageGlobal(totalGlobal.totalMaintenance),
          pourcentageDans5M: calculerPourcentageDans5MGlobal(totalGlobal.totalMaintenance)
        },
        qualite: {
          quantite: totalGlobal.totalQualite,
          pourcentageSource: calculerPourcentageGlobal(totalGlobal.totalQualite),
          pourcentageDans5M: calculerPourcentageDans5MGlobal(totalGlobal.totalQualite)
        },
        environnement: {  // ✅ AJOUTÉ
          quantite: totalGlobal.totalEnvironnement,
          pourcentageSource: calculerPourcentageGlobal(totalGlobal.totalEnvironnement),
          pourcentageDans5M: calculerPourcentageDans5MGlobal(totalGlobal.totalEnvironnement)
        }
      }
    };

    // 9. Préparer la réponse finale
    const response = {
      message: `Statistiques 5M par ligne pour le ${date}`,
      periode: {
        date: date,
        jour: jour,
        semaine: semaine,
        dateCalcul: new Date().toISOString()
      },
      resumeGlobal: {
        nombreLignes: lignesFormatees.length,
        nombreTotalReferences: planifications.length
      },
      resumeTotalJour: resumeTotalJour,
      lignes: lignesFormatees
    };

    console.log(`=== FIN CALCUL 5M PAR LIGNE POUR ${date} ===`);
    return response;

  } catch (error) {
    console.error(`Erreur dans getStats5MParDate:`, error);
    
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des 5M par date: ${error.message}`
    );
  }
}

async getProductiviteOuvriers(dateDebut: string, dateFin: string) {
  console.log(`=== CALCUL PRODUCTIVITÉ OUVRIERS ${dateDebut} à ${dateFin} ===`);

  try {
    // 1. Valider les dates
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    
    if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
      throw new BadRequestException('Format de date invalide');
    }
    
    if (debut > fin) {
      throw new BadRequestException('La date de début doit être avant la date de fin');
    }

    // 2. Récupérer tous les ouvriers
    const tousLesOuvriers = await this.ouvrierRepository.find({
      order: { matricule: 'ASC' }
    });

    if (tousLesOuvriers.length === 0) {
      throw new NotFoundException('Aucun ouvrier trouvé dans la base');
    }

    console.log(`👥 Total ouvriers: ${tousLesOuvriers.length}`);

    // 3. Récupérer les plannings de sélection pour la période
    // NOTE: Vous devez injecter le repository PlanningSelection
    const planningsSelection = await this.planningSelectionRepository.find({
      where: {
        date: Between(dateDebut, dateFin)
      },
      order: { date: 'ASC', matricule: 'ASC' }
    });

    console.log(`📋 Plannings sélection trouvés: ${planningsSelection.length}`);

    // 4. Grouper les plannings par matricule+date pour accès rapide
    const planningsMap = new Map<string, any>();
    planningsSelection.forEach(planning => {
      const key = `${planning.matricule}_${planning.date}`;
      planningsMap.set(key, planning);
    });

    // 5. Générer toutes les dates dans la période
    const datesPeriode = this.genererDatesEntre(debut, fin);
    console.log(`📅 Jours dans période: ${datesPeriode.length}`);

    // 6. Parcourir tous les ouvriers et toutes les dates
    const resultats: any[] = [];

    for (const ouvrier of tousLesOuvriers) {
      for (const dateObj of datesPeriode) {
        const dateStr = dateObj.toISOString().split('T')[0];
        
        // Convertir date en semaine+jour
        const { semaine, jour } = this.convertirDateEnSemaineEtJour(dateStr);
        
        const keyPlanning = `${ouvrier.matricule}_${dateStr}`;
        const planning = planningsMap.get(keyPlanning);
        
        // A. CAS 1: Ouvrier a un planning de sélection
        if (planning) {
          console.log(`✅ Planning trouvé: ${ouvrier.matricule} - ${dateStr}`);
          
          const resultat = {
            JOURS: dateStr,
            MAT: ouvrier.matricule,
            "NOM ET PRENOM": ouvrier.nomPrenom,
            "N°HEURS": planning.nHeures || 0,
            LIGNES: planning.ligne || "selection",
            PRODUCTIVITE: planning.rendement || 0, // RENDEMENT = PRODUCTIVITÉ
            M1: 0,
            M2: 0,
            M3: 0,
            M4: 0,
            M5: 0,
            M6: 0,
            M7: 0,
            "PRODUCTIVITE MOYENNE": null,
            NOTE: "",
            _source: "planning-selection"
          };
          
          resultats.push(resultat);
          continue;
        }
        
        // B. CAS 2: Chercher si l'ouvrier a des rapports de saisie ce jour
        const rapportsOuvrier = await this.saisieRapportRepository.find({
          where: {
            matricule: ouvrier.matricule,
            semaine,
            jour
          }
        });
        
        if (rapportsOuvrier.length > 0) {
          console.log(`📊 Rapports trouvés: ${ouvrier.matricule} - ${dateStr}`);
          
          // Prendre la première ligne (normalement même ligne pour un ouvrier le même jour)
          const rapport = rapportsOuvrier[0];
          
          // Calculer la productivité et 7M pour CET OUVRRIER
          const calculs = await this.calculerProductiviteEt7MPourOuvrier(
            ouvrier.matricule,
            semaine,
            jour,
            rapport.ligne
          );
          
          const resultat = {
            JOURS: dateStr,
            MAT: ouvrier.matricule,
            "NOM ET PRENOM": ouvrier.nomPrenom,
            "N°HEURS": rapport.totalHeuresJour,
            LIGNES: rapport.ligne,
            PRODUCTIVITE: calculs.productivite,
            M1: calculs.causes7M.matierePremiere,
            M2: calculs.causes7M.methode,
            M3: calculs.causes7M.maintenance,
            M4: calculs.causes7M.qualite,
            M5: calculs.causes7M.absence,
            M6: calculs.causes7M.rendement,
            M7: calculs.causes7M.environnement,
            "PRODUCTIVITE MOYENNE": null,
            NOTE: "",
            _source: "rapports-saisie"
          };
          
          resultats.push(resultat);
        }
        // C. CAS 3: Pas de données pour cet ouvrier ce jour → on ne crée pas d'entrée
      }
    }

    // 7. Trier par date puis matricule
    resultats.sort((a, b) => {
      if (a.JOURS < b.JOURS) return -1;
      if (a.JOURS > b.JOURS) return 1;
      return a.MAT - b.MAT;
    });

    // 8. Statistiques
    const statistiques = {
      periode: {
        dateDebut,
        dateFin,
        joursTotal: datesPeriode.length
      },
      resume: {
        nombreOuvriersTotal: tousLesOuvriers.length,
        nombreResultats: resultats.length,
        parSource: {
          planningSelection: resultats.filter(r => r._source === "planning-selection").length,
          rapportsSaisie: resultats.filter(r => r._source === "rapports-saisie").length
        }
      }
    };

    // 9. Nettoyer les résultats
    const resultatsFinaux = resultats.map(({ _source, ...rest }) => rest);

    console.log(`=== FIN CALCUL PRODUCTIVITÉ ===`);
    console.log(`Résultats: ${resultatsFinaux.length} lignes`);

    return {
      message: `Productivité des ouvriers du ${dateDebut} au ${dateFin}`,
      periode: { dateDebut, dateFin, dateCalcul: new Date().toISOString() },
      statistiques,
      tableau: resultatsFinaux,
      donneesFormatees: {
        entetes: [
          "JOURS", "MAT", "NOM ET PRENOM", "N°HEURS", "LIGNES", 
          "PRODUCTIVITE", "M1", "M2", "M3", "M4", "M5", "M6", "M7",
          "PRODUCTIVITE MOYENNE", "NOTE"
        ],
        lignes: resultatsFinaux
      }
    };

  } catch (error) {
    console.error(`❌ Erreur getProductiviteOuvriers:`, error);
    
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul de la productivité: ${error.message}`
    );
  }
}

// MÉTHODE UTILITAIRE : Générer dates entre deux dates
private genererDatesEntre(debut: Date, fin: Date): Date[] {
  const dates: Date[] = [];
  const dateCourante = new Date(debut);
  
  while (dateCourante <= fin) {
    dates.push(new Date(dateCourante));
    dateCourante.setDate(dateCourante.getDate() + 1);
  }
  
  return dates;
}


private async calculerProductiviteEt7MPourOuvrier(
  matricule: number, 
  semaine: string, 
  jour: string, 
  ligne: string
): Promise<{ productivite: number; causes7M: any }> {
  try {
    console.log(`🧮 Calcul productivité pour ${matricule} - ${semaine} - ${jour} - ${ligne}`);
    
    // 1. Récupérer les rapports de saisie de cet ouvrier pour ce jour
    const rapportsOuvrier = await this.saisieRapportRepository.find({
      where: {
        matricule,
        semaine,
        jour,
        ligne
      }
    });

    if (rapportsOuvrier.length === 0) {
      console.log(`⚠️ Aucun rapport trouvé pour ${matricule} le ${jour}`);
      return {
        productivite: 0,
        causes7M: {
          matierePremiere: 0,
          absence: 0,
          rendement: 0,
          methode: 0,
          maintenance: 0,
          qualite: 0,
          environnement: 0
        }
      };
    }

    // 2. Récupérer les planifications pour cette ligne à ce jour
    const planifications = await this.planificationRepository.find({
      where: { 
        semaine, 
        jour, 
        ligne 
      },
      relations: ['nonConformites']
    });

    if (planifications.length === 0) {
      console.log(`⚠️ Aucune planification trouvée pour ${ligne} le ${jour}`);
      return {
        productivite: 0,
        causes7M: {
          matierePremiere: 0,
          absence: 0,
          rendement: 0,
          methode: 0,
          maintenance: 0,
          qualite: 0,
          environnement: 0
        }
      };
    }

    // 3. Calculer la productivité RÉELLE pour cet ouvrier
    // Basé sur les heures travaillées et les planifications
    
    let totalHeuresOuvrier = 0;
    let totalDecProductionAttribuee = 0;
    
    // Pour cet exemple, on va attribuer la production proportionnellement aux heures
    // Vous devrez adapter cette logique selon votre métier
    
    // Calculer le total des heures de tous les ouvriers sur cette ligne ce jour
    const totalHeuresLigne = rapportsOuvrier.reduce((sum, r) => sum + r.totalHeuresJour, 0);
    
    if (totalHeuresLigne <= 0) {
      console.log(`⚠️ Aucune heure travaillée sur ${ligne} le ${jour}`);
      return {
        productivite: 0,
        causes7M: {
          matierePremiere: 0,
          absence: 0,
          rendement: 0,
          methode: 0,
          maintenance: 0,
          qualite: 0,
          environnement: 0
        }
      };
    }

    // Heures de cet ouvrier
    totalHeuresOuvrier = rapportsOuvrier.reduce((sum, r) => sum + r.totalHeuresJour, 0);
    
    // Calculer la production totale de la ligne ce jour
    const totalDecProductionLigne = planifications.reduce((sum, p) => sum + p.decProduction, 0);
    const totalQteSourceLigne = planifications.reduce((sum, p) => {
      return sum + (p.qteModifiee > 0 ? p.qteModifiee : p.qtePlanifiee);
    }, 0);

    // 4. Attribuer la production proportionnellement aux heures
    const ratioHeuresOuvrier = totalHeuresOuvrier / totalHeuresLigne;
    totalDecProductionAttribuee = totalDecProductionLigne * ratioHeuresOuvrier;

    // 5. Calculer la productivité
    let productivite = 0;
    if (totalQteSourceLigne > 0) {
      // Calculer la productivité de la ligne
      const productiviteLigne = (totalDecProductionLigne / totalQteSourceLigne) * 100;
      
      // Pour cet ouvrier, on utilise la productivité de la ligne
      // (ou vous pouvez avoir une logique plus fine)
      productivite = productiviteLigne;
    }

    // 6. Calculer les 7M pour cet ouvrier (proportionnellement)
    // Initialiser les totaux
    const totaux7MLigne = {
      matierePremiere: 0,
      absence: 0,
      rendement: 0,
      methode: 0,
      maintenance: 0,
      qualite: 0,
      environnement: 0
    };

    // Accumuler les 7M de toutes les planifications
    planifications.forEach(plan => {
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        totaux7MLigne.matierePremiere += nonConf.matierePremiere;
        totaux7MLigne.absence += nonConf.absence;
        totaux7MLigne.rendement += nonConf.rendement;
        totaux7MLigne.methode += nonConf.methode;
        totaux7MLigne.maintenance += nonConf.maintenance;
        totaux7MLigne.qualite += nonConf.qualite;
        totaux7MLigne.environnement += nonConf.environnement;
      }
    });

    // Calculer les pourcentages 7M (par rapport à qteSource)
    const calculerPourcentage7M = (valeur: number): number => {
      if (totalQteSourceLigne <= 0) return 0;
      return Math.round((valeur / totalQteSourceLigne) * 100 * 10) / 10;
    };

    const causes7M = {
      matierePremiere: calculerPourcentage7M(totaux7MLigne.matierePremiere),
      absence: calculerPourcentage7M(totaux7MLigne.absence),
      rendement: calculerPourcentage7M(totaux7MLigne.rendement),
      methode: calculerPourcentage7M(totaux7MLigne.methode),
      maintenance: calculerPourcentage7M(totaux7MLigne.maintenance),
      qualite: calculerPourcentage7M(totaux7MLigne.qualite),
      environnement: calculerPourcentage7M(totaux7MLigne.environnement)
    };

    console.log(`📈 Productivité ${matricule}: ${productivite}%`);
    console.log(`📊 7M ${matricule}:`, causes7M);

    return {
      productivite: Math.round(productivite * 100) / 100,
      causes7M
    };

  } catch (error) {
    console.error(`❌ Erreur calculProductiviteEt7MPourOuvrier:`, error);
    return {
      productivite: 0,
      causes7M: {
        matierePremiere: 0,
        absence: 0,
        rendement: 0,
        methode: 0,
        maintenance: 0,
        qualite: 0,
        environnement: 0
      }
    };
  }
}

private async calculerProductiviteEt5MPourLigneJour(semaine: string, jour: string, ligne: string) {
  try {
    console.log(`Calcul productivité pour ${semaine}-${jour}-${ligne}`);
    
    // 1. Récupérer toutes les planifications pour cette ligne à ce jour
    const planifications = await this.planificationRepository.find({
      where: { semaine, jour, ligne },
      relations: ['nonConformites']
    });

    if (planifications.length === 0) {
      console.warn(`Aucune planification trouvée pour ${semaine}-${jour}-${ligne}`);
      return {
        productiviteReelle: 0,
        causes5M: {
          matierePremiere: 0,
          absence: 0,
          rendement: 0,
          methode: 0,
          maintenance: 0,
          qualite: 0,
          environnement: 0 // ✅ AJOUTÉ
        }
      };
    }

    // 2. Calculer les totaux
    let totalQteSource = 0;
    let totalDecProduction = 0;
    let totalMatierePremiere = 0;
    let totalAbsence = 0;
    let totalRendement = 0;
    let totalMethode = 0;
    let totalMaintenance = 0;
    let totalQualite = 0;
    let totalEnvironnement = 0; // ✅ AJOUTÉ

    // 3. Parcourir toutes les planifications
    for (const plan of planifications) {
      // Calculer la quantité source
      const quantiteSource = plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee;
      
      totalQteSource += quantiteSource;
      totalDecProduction += plan.decProduction;

      // Vérifier s'il y a des non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        totalMatierePremiere += nonConf.matierePremiere;
        totalAbsence += nonConf.absence;
        totalRendement += nonConf.rendement;
        totalMethode += nonConf.methode;
        totalMaintenance += nonConf.maintenance;
        totalQualite += nonConf.qualite;
        totalEnvironnement += nonConf.environnement; // ✅ AJOUTÉ
      }
    }

    console.log(`Totaux pour ${ligne}: QteSource=${totalQteSource}, DecProd=${totalDecProduction}`);

    // 4. ✅ CORRECTION : Calculer la productivité réelle
    let productiviteReelle = 0;
    if (totalQteSource > 0) {
      productiviteReelle = (totalDecProduction / totalQteSource) * 100;
      productiviteReelle = Math.round(productiviteReelle * 100) / 100; // 2 décimales
    }

    // 5. ✅ CORRECTION : Calculer les pourcentages 5M (par rapport à qteSource)
    const calculerPourcentage5M = (valeur: number): number => {
      if (totalQteSource <= 0) return 0;
      const pourcentage = (valeur / totalQteSource) * 100;
      return Math.round(pourcentage * 10) / 10; // 1 décimale
    };

    const causes5M = {
      matierePremiere: calculerPourcentage5M(totalMatierePremiere),
      absence: calculerPourcentage5M(totalAbsence),
      rendement: calculerPourcentage5M(totalRendement),
      methode: calculerPourcentage5M(totalMethode),
      maintenance: calculerPourcentage5M(totalMaintenance),
      qualite: calculerPourcentage5M(totalQualite),
      environnement: calculerPourcentage5M(totalEnvironnement) // ✅ AJOUTÉ
    };

    // 6. Vérifier la cohérence
    const somme5M = Object.values(causes5M).reduce((sum, val) => sum + val, 0);
    const total = productiviteReelle + somme5M;
    const difference = Math.abs(100 - total);

    console.log(`Vérification: Productivité=${productiviteReelle}%, 5M=${somme5M}%, Total=${total}%, Diff=${difference}`);

    // 7. Ajuster si nécessaire (arrondis)
    if (difference > 0.1 && totalQteSource > 0) {
      console.log(`Ajustement nécessaire: Différence de ${difference}%`);
      // Normaliser pour que la somme fasse 100%
      const facteur = 100 / total;
      productiviteReelle = Math.round(productiviteReelle * facteur * 100) / 100;
    }

    return {
      productiviteReelle,
      causes5M,
      // Données brutes pour débogage
      _rawData: {
        totalQteSource,
        totalDecProduction,
        totauxBruts: {
          matierePremiere: totalMatierePremiere,
          absence: totalAbsence,
          rendement: totalRendement,
          methode: totalMethode,
          maintenance: totalMaintenance,
          qualite: totalQualite,
          environnement: totalEnvironnement // ✅ AJOUTÉ
        }
      }
    };

  } catch (error) {
    console.error(`Erreur dans calculerProductiviteEt5MPourLigneJour:`, error);
    return {
      productiviteReelle: 0,
      causes5M: {
        matierePremiere: 0,
        absence: 0,
        rendement: 0,
        methode: 0,
        maintenance: 0,
        qualite: 0,

      }
    };
  }
}

/**
 * NOUVELLE MÉTHODE : Vérifier les totaux de productivité
 */
private verifierTotauxProductivite(resultats: any[]): any {
  const lignesUniques = [...new Set(resultats.map(r => `${r.JOURS}-${r.LIGNES}`))];
  const statistiquesVerif: any[] = [];

  lignesUniques.forEach(key => {
    const [date, ligne] = key.split('-');
    const lignesPourDateLigne = resultats.filter(r => r.JOURS === date && r.LIGNES === ligne);
    
    if (lignesPourDateLigne.length > 0) {
      const premiereLigne = lignesPourDateLigne[0];
      const somme5M = premiereLigne.M1 + premiereLigne.M2 + premiereLigne.M3 + 
                      premiereLigne.M4 + premiereLigne.M5 + premiereLigne.M6+ premiereLigne.M7; // ✅ MODIFIÉ pour inclure M7
      const total = premiereLigne.PRODUCTIVITE + somme5M;
      
      statistiquesVerif.push({
        date,
        ligne,
        productivite: premiereLigne.PRODUCTIVITE,
        somme5M,
        total: Math.round(total * 100) / 100,
        difference: Math.round((100 - total) * 100) / 100,
        estValide: Math.abs(100 - total) < 1 // Tolérance de 1%
      });
    }
  });

  const lignesValides = statistiquesVerif.filter(s => s.estValide).length;
  const lignesInvalides = statistiquesVerif.filter(s => !s.estValide).length;

  return {
    statistiquesVerif,
    resume: {
      totalLignesVerifiees: statistiquesVerif.length,
      lignesValides,
      lignesInvalides,
      tauxValidite: lignesValides > 0 ? Math.round((lignesValides / statistiquesVerif.length) * 100) : 0
    }
  };
}

// Garder les autres méthodes utilitaires inchangées...

/**
 * Méthode utilitaire : Récupérer les causes 5M pour une ligne à une date spécifique
 */
private async getCauses5MPourLigneDate(semaine: string, jour: string, ligne: string) {
  try {
    // 1. Récupérer toutes les planifications pour cette ligne à ce jour
    const planifications = await this.planificationRepository.find({
      where: { semaine, jour, ligne },
      relations: ['nonConformites']
    });

    // Initialiser les totaux
    let totalQtePlanifiee = 0;
    let totalMatierePremiere = 0;
    let totalAbsence = 0;
    let totalRendement = 0;
    let totalMethode = 0;
    let totalMaintenance = 0;
    let totalQualite = 0;
    let totalEnvironnement = 0; // ✅ AJOUTÉ

    // 2. Parcourir toutes les planifications
    for (const plan of planifications) {
      totalQtePlanifiee += plan.qtePlanifiee;

      // Vérifier s'il y a des non-conformités
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        totalMatierePremiere += nonConf.matierePremiere;
        totalAbsence += nonConf.absence;
        totalRendement += nonConf.rendement;
        totalMethode += nonConf.methode;
        totalMaintenance += nonConf.maintenance;
        totalQualite += nonConf.qualite;
        totalEnvironnement += nonConf.environnement; // ✅ AJOUTÉ
      }
    }

    // 3. Calculer les pourcentages (par rapport à qtePlanifiee)
    const calculerPourcentage = (valeur: number): number => {
      if (totalQtePlanifiee <= 0) return 0;
      return Math.round((valeur / totalQtePlanifiee) * 100 * 10) / 10; // Une décimale
    };

    return {
      matierePremiere: calculerPourcentage(totalMatierePremiere),
      absence: calculerPourcentage(totalAbsence),
      rendement: calculerPourcentage(totalRendement),
      methode: calculerPourcentage(totalMethode),
      maintenance: calculerPourcentage(totalMaintenance),
      qualite: calculerPourcentage(totalQualite),
      totalQtePlanifiee,
      // Totaux bruts pour information
      totauxBruts: {
        matierePremiere: totalMatierePremiere,
        absence: totalAbsence,
        rendement: totalRendement,
        methode: totalMethode,
        maintenance: totalMaintenance,
        qualite: totalQualite,
        environnement: totalEnvironnement // ✅ AJOUTÉ
      }
    };

  } catch (error) {
    console.error(`Erreur getCauses5MPourLigneDate:`, error);
    // Retourner des zéro en cas d'erreur
    return {
      matierePremiere: 0,
      absence: 0,
      rendement: 0,
      methode: 0,
      maintenance: 0,
      qualite: 0,
      environnement: 0, // ✅ AJOUTÉ
      totalQtePlanifiee: 0,
      totauxBruts: {
        matierePremiere: 0,
        absence: 0,
        rendement: 0,
        methode: 0,
        maintenance: 0,
        qualite: 0,
        environnement: 0 // ✅ AJOUTÉ
      }
    };
  }
}

/**
 * Méthode utilitaire : Récupérer les semaines entre deux dates
 */
private async getSemainesEntreDates(dateDebut: string, dateFin: string): Promise<string[]> {
  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);
  
  // ✅ NOUVELLE LOGIQUE : Trouver les semaines dont la période chevauche la période demandée
  const semaines = await this.semaineRepository
    .createQueryBuilder('semaine')
    .where('semaine.dateDebut <= :fin', { fin: fin.toISOString().split('T')[0] })
    .andWhere('semaine.dateFin >= :debut', { debut: debut.toISOString().split('T')[0] })
    .orderBy('semaine.dateDebut', 'ASC')
    .getMany();

  // ✅ Si aucune semaine trouvée et que c'est le même jour, chercher la semaine qui contient ce jour
  if (semaines.length === 0 && dateDebut === dateFin) {
    console.log('⚠️ Recherche de la semaine contenant le jour:', dateDebut);
    const semaine = await this.semaineRepository
      .createQueryBuilder('semaine')
      .where(':date BETWEEN semaine.dateDebut AND semaine.dateFin', { 
        date: dateDebut 
      })
      .getOne();
    
    if (semaine) {
      return [semaine.nom];
    }
  }

  return semaines.map(s => s.nom);
}

/**
 * Méthode utilitaire : Convertir semaine+jour en date réelle
 */
private async convertirSemaineJourEnDate(semaine: string, jour: string, dateReference: string): Promise<Date> {
  try {
    // Récupérer la semaine pour obtenir sa date de début
    const semaineEntity = await this.semaineRepository.findOne({
      where: { nom: semaine }
    });

    if (!semaineEntity) {
      // Fallback : utiliser la date de référence
      return new Date(dateReference);
    }

    const dateDebutSemaine = semaineEntity.dateDebut instanceof Date 
      ? semaineEntity.dateDebut 
      : new Date(semaineEntity.dateDebut);

    // Mapping des jours
    const joursIndex: Record<string, number> = {
      'lundi': 0,
      'mardi': 1,
      'mercredi': 2,
      'jeudi': 3,
      'vendredi': 4,
      'samedi': 5,
      'dimanche': 6
    };

    const jourIndex = joursIndex[jour.toLowerCase()] || 0;
    
    // Ajouter le nombre de jours
    const dateResultat = new Date(dateDebutSemaine);
    dateResultat.setDate(dateDebutSemaine.getDate() + jourIndex);
    
    return dateResultat;

  } catch (error) {
    console.error(`Erreur convertirSemaineJourEnDate:`, error);
    return new Date(dateReference);
  }
}

/**
 * Méthode utilitaire : Vérifier si une date est dans une plage
 */


/**
 * Méthode utilitaire : Calculer le nombre de jours entre deux dates
 */
private calculerNombreJours(debut: Date, fin: Date): number {
  const diffTemps = fin.getTime() - debut.getTime();
  const diffJours = Math.ceil(diffTemps / (1000 * 60 * 60 * 24));
  return diffJours + 1; // Inclure le jour de début
}

/**
 * Méthode utilitaire : Calculer la répartition par ligne
 */
private calculerRepartitionParLigne(resultats: any[]): Record<string, any> {
  const repartition: Record<string, any> = {};
  
  resultats.forEach(resultat => {
    const ligne = resultat.LIGNES;
    
    if (!repartition[ligne]) {
      repartition[ligne] = {
        nombreRapports: 0,
        totalHeures: 0,
        ouvriers: new Set<number>(),
        productiviteMoyenne: 0
      };
    }
    
    repartition[ligne].nombreRapports++;
    repartition[ligne].totalHeures += resultat["N°HEURS"];
    repartition[ligne].ouvriers.add(resultat.MAT);
  });

  // Calculer la productivité moyenne par ligne
  Object.keys(repartition).forEach(ligne => {
    const rapportsLigne = resultats.filter(r => r.LIGNES === ligne);
    if (rapportsLigne.length > 0) {
      const productiviteMoyenne = rapportsLigne.reduce((sum, r) => sum + r.PRODUCTIVITE, 0) / rapportsLigne.length;
      repartition[ligne].productiviteMoyenne = Math.round(productiviteMoyenne * 100) / 100;
      repartition[ligne].nombreOuvriers = repartition[ligne].ouvriers.size;
      delete repartition[ligne].ouvriers; // Nettoyer
    }
  });

  return repartition;
}

/**
 * Méthode utilitaire : Calculer les totaux des causes 5M
 */
private calculerTotauxCauses5M(resultats: any[]): Record<string, any> {
  const totaux = {
    M1: 0,
    M2: 0,
    M3: 0,
    M4: 0,
    M5: 0,
    M6: 0,
    M7: 0 // ✅ AJOUTÉ
  };

  let nombreLignesAvecCauses = 0;

  resultats.forEach(resultat => {
    // Vérifier si au moins une cause a une valeur > 0
    const aDesCauses = resultat.M1 > 0 || resultat.M2 > 0 || resultat.M3 > 0 || 
                       resultat.M4 > 0 || resultat.M5 > 0 || resultat.M6 > 0 || resultat.M7 > 0; // ✅ MODIFIÉ pour inclure M7
    
    if (aDesCauses) {
      totaux.M1 += resultat.M1;
      totaux.M2 += resultat.M2;
      totaux.M3 += resultat.M3;
      totaux.M4 += resultat.M4;
      totaux.M5 += resultat.M5;
      totaux.M6 += resultat.M6;
      totaux.M7 += resultat.M7; // ✅ AJOUTÉ
      nombreLignesAvecCauses++;
    }
  });

  // Calculer les moyennes
  const moyennes = {
    M1: nombreLignesAvecCauses > 0 ? Math.round(totaux.M1 / nombreLignesAvecCauses * 10) / 10 : 0,
    M2: nombreLignesAvecCauses > 0 ? Math.round(totaux.M2 / nombreLignesAvecCauses * 10) / 10 : 0,
    M3: nombreLignesAvecCauses > 0 ? Math.round(totaux.M3 / nombreLignesAvecCauses * 10) / 10 : 0,
    M4: nombreLignesAvecCauses > 0 ? Math.round(totaux.M4 / nombreLignesAvecCauses * 10) / 10 : 0,
    M5: nombreLignesAvecCauses > 0 ? Math.round(totaux.M5 / nombreLignesAvecCauses * 10) / 10 : 0,
    M6: nombreLignesAvecCauses > 0 ? Math.round(totaux.M6 / nombreLignesAvecCauses * 10) / 10 : 0,
    M7: nombreLignesAvecCauses > 0 ? Math.round(totaux.M7 / nombreLignesAvecCauses * 10) / 10 : 0 // ✅ AJOUTÉ
  };

  return {
    totaux,
    moyennes,
    nombreLignesAvecCauses
  };
}

/**
 * ✅ NOUVELLE MÉTHODE : Statistiques complètes sur une période
 * Inclut : Production par ligne, 7M, production globale, personnel
 */
async getStatsParPeriode(dateDebut: string, dateFin: string) {
  console.log(`=== CALCUL STATS POUR PÉRIODE ${dateDebut} à ${dateFin} ===`);

  try {
    // 1. Valider les dates
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    
    if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
      throw new BadRequestException('Format de date invalide');
    }
    
    if (debut > fin) {
      throw new BadRequestException('La date de début doit être avant la date de fin');
    }

    // ✅ MODIFICATION : Si c'est la même date, traiter comme un seul jour
    const estMemeDate = dateDebut === dateFin;
    
    // 2. Obtenir toutes les semaines dans la période
    const semaines = await this.getSemainesEntreDates(dateDebut, dateFin);
    
    if (semaines.length === 0) {
      throw new NotFoundException(
        `Aucune semaine trouvée entre ${dateDebut} et ${dateFin}`
      );
    }

    console.log(`Semaines trouvées: ${semaines.join(', ')}`);
    console.log(`Mode: ${estMemeDate ? 'Jour unique' : 'Période multiple jours'}`);

    // 3. Calculer les statistiques en parallèle
    const [productionStats, personnelStats] = await Promise.all([
      this.calculerProductionEt7MPourPeriode(semaines, dateDebut, dateFin, estMemeDate),
      this.calculerPersonnelPourPeriode(dateDebut, dateFin, estMemeDate)
    ]);

    // 4. Calculer les totaux globaux
    const productionGlobale = this.calculerProductionGlobale(productionStats.statsParLigne);

    // 5. Récupérer les détails des non-conformités pour la période
    const detailsNonConformites = await this.getDetailsNonConformitesPourPeriode(semaines, dateDebut, dateFin, estMemeDate);

    // 6. Préparer la réponse
    const response = {
      message: estMemeDate 
        ? `Statistiques complètes pour le ${dateDebut}`
        : `Statistiques complètes pour la période du ${dateDebut} au ${dateFin}`,
      periode: {
        dateDebut,
        dateFin,
        nombreSemaines: semaines.length,
        joursDansPeriode: personnelStats.joursDansPeriode,
        estJourUnique: estMemeDate, // ✅ Nouveau champ
        dateCalcul: new Date().toISOString()
      },
      productionGlobale: {
        ...productionGlobale,
        oee: null
      },
      statsParLigne: productionStats.statsParLigne,
      personnel: personnelStats,
      resume7M: productionStats.resume7M,
      detailsNonConformites: detailsNonConformites
    };

    console.log(`=== FIN CALCUL STATS POUR PÉRIODE ===`);
    console.log(`Mode: ${estMemeDate ? 'Jour unique' : 'Période'}`);
    console.log(`Lignes: ${productionStats.statsParLigne.length}`);
    console.log(`Production globale: ${productionGlobale.pcsTotal}%`);

    return response;

  } catch (error) {
    console.error(`Erreur dans getStatsParPeriode:`, error);
    
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors du calcul des statistiques pour la période: ${error.message}`
    );
  }
}

/**
 * ✅ NOUVELLE MÉTHODE : Récupérer les détails des non-conformités pour une période
 */
private async getDetailsNonConformitesPourPeriode(
  semaines: string[], 
  dateDebut: string, 
  dateFin: string,
  estMemeDate: boolean = false
): Promise<any[]> {
  try {
    // Récupérer toutes les planifications avec leurs non-conformités
    const planifications = await this.planificationRepository.find({
      where: semaines.map(semaine => ({ semaine })),
      relations: ['nonConformites'],
      order: { ligne: 'ASC', semaine: 'ASC', jour: 'ASC', reference: 'ASC' }
    });

    if (planifications.length === 0) {
      return [];
    }

    const details: any[] = [];
    const dateDebutObj = new Date(dateDebut);
    const dateFinObj = new Date(dateFin);

    // Parcourir toutes les planifications
    for (const plan of planifications) {
      // Convertir semaine+jour en date
      const datePlan = await this.getDateFromSemaineJour(plan.semaine, plan.jour);
      const datePlanObj = new Date(datePlan);
      
      // ✅ FILTRE IMPORTANT : Vérifier si la date est dans la période demandée
      // Si c'est le même jour, on filtre strictement
      if (estMemeDate) {
        // Pour un jour unique, on compare les dates complètes
        if (datePlan !== dateDebut) {
          continue; // Ignorer les autres jours
        }
      } else {
        // Pour une période, vérifier si la date est dans l'intervalle
        if (datePlanObj < dateDebutObj || datePlanObj > dateFinObj) {
          continue;
        }
      }
      
      const quantiteSource = this.getQuantitySource(plan);
      
      // Préparer le détail de base
      const detail: any = {
        date: await this.getDateFromSemaineJour(plan.semaine, plan.jour),
        jour: plan.jour,
        semaine: plan.semaine,
        ligne: plan.ligne,
        reference: plan.reference,
        of: plan.of || '',
        qtyPlanifiee: plan.qtePlanifiee,
        qtyModifiee: plan.qteModifiee,
        qtyProduite: plan.decProduction,
        delta: plan.decProduction - quantiteSource,
        pcsProd: plan.pcsProd || 0,
        m1_matierePremiere: 0,
        m2_absence: 0,
        m3_rendement: 0,
        m4_methode: 0,
        m5_maintenance: 0,
        m6_qualite: 0,
        m7_environnement: 0,
        total7M: 0,
        pourcentageEcart: 0,
        refMP: null,
        refQualite: null,
        commentaire: null
      };

      // Ajouter les non-conformités si elles existent
      if (plan.nonConformites && plan.nonConformites.length > 0) {
        const nonConf = plan.nonConformites[0];
        
        detail.m1_matierePremiere = nonConf.matierePremiere;
        detail.m2_absence = nonConf.absence;
        detail.m3_rendement = nonConf.rendement;
        detail.m4_methode = nonConf.methode;
        detail.m5_maintenance = nonConf.maintenance;
        detail.m6_qualite = nonConf.qualite;
        detail.m7_environnement = nonConf.environnement;
        detail.total7M = nonConf.total;
        detail.refMP = nonConf.referenceMatierePremiere;
        detail.refQualite = nonConf.referenceQualite;
        detail.commentaire = nonConf.commentaire;
        
        // Calculer le pourcentage d'écart
        if (quantiteSource > 0) {
          detail.pourcentageEcart = (nonConf.total / quantiteSource) * 100;
        }
      }

      // Ajouter uniquement si il y a une non-conformité
      if (detail.total7M > 0) {
        details.push(detail);
      }
    }

    return details;

  } catch (error) {
    console.error('Erreur dans getDetailsNonConformitesPourPeriode:', error);
    return [];
  }
}

/**
 * Méthode utilitaire : Convertir semaine+jour en date
 */
private async getDateFromSemaineJour(semaine: string, jour: string): Promise<string> {
  try {
    // Récupérer la semaine pour obtenir sa date de début
    const semaineEntity = await this.semaineRepository.findOne({
      where: { nom: semaine }
    });

    if (!semaineEntity) {
      return new Date().toISOString().split('T')[0];
    }

    const dateDebutSemaine = semaineEntity.dateDebut instanceof Date 
      ? semaineEntity.dateDebut 
      : new Date(semaineEntity.dateDebut);

    // Mapping des jours
    const joursIndex: Record<string, number> = {
      'lundi': 0,
      'mardi': 1,
      'mercredi': 2,
      'jeudi': 3,
      'vendredi': 4,
      'samedi': 5,
      'dimanche': 6
    };

    const jourIndex = joursIndex[jour.toLowerCase()] || 0;
    
    // Ajouter le nombre de jours
    const dateResultat = new Date(dateDebutSemaine);
    dateResultat.setDate(dateDebutSemaine.getDate() + jourIndex);
    
    return dateResultat.toISOString().split('T')[0];

  } catch (error) {
    console.error('Erreur getDateFromSemaineJour:', error);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Méthode utilitaire : Calculer production et 7M pour la période
 */
private async calculerProductionEt7MPourPeriode(
  semaines: string[], 
  dateDebut: string, 
  dateFin: string,
  estMemeDate: boolean = false
) {
  // Récupérer toutes les planifications pour ces semaines AVEC les vraies données
  const planifications = await this.planificationRepository.find({
    where: semaines.map(semaine => ({ semaine })),
    relations: ['nonConformites'],
    order: { ligne: 'ASC', semaine: 'ASC', jour: 'ASC' }
  });

  console.log(`Planifications initiales trouvées: ${planifications.length}`);
  
  // ✅ FILTRER par date si c'est un jour unique
  let planificationsFiltrees = planifications;
  
  if (estMemeDate) {
    console.log(`🔍 Filtrage pour jour unique: ${dateDebut}`);
    
    // Créer un tableau pour stocker les planifications filtrées
    const filtered: Planification[] = [];
    
    for (const plan of planifications) {
      try {
        // Convertir semaine+jour en date
        const datePlan = await this.getDateFromSemaineJour(plan.semaine, plan.jour);
        
        // Pour un jour unique : comparer les dates (format YYYY-MM-DD)
        if (datePlan === dateDebut) {
          filtered.push(plan);
          console.log(`  ✅ Gardé: ${plan.ligne} - ${plan.reference} - ${plan.semaine} - ${plan.jour} (${datePlan})`);
        } else {
          console.log(`  ❌ Ignoré: ${plan.ligne} - ${plan.reference} - ${plan.semaine} - ${plan.jour} (${datePlan} != ${dateDebut})`);
        }
      } catch (error) {
        console.error(`Erreur conversion date pour ${plan.semaine}-${plan.jour}:`, error);
      }
    }
    
    planificationsFiltrees = filtered;
    console.log(`Planifications après filtrage jour unique: ${planificationsFiltrees.length}`);
  } else {
    // Pour une période normale, filtrer entre dateDebut et dateFin
    console.log(`🔍 Filtrage pour période: ${dateDebut} à ${dateFin}`);
    const dateDebutObj = new Date(dateDebut);
    const dateFinObj = new Date(dateFin);
    
    const filtered: Planification[] = [];
    
    for (const plan of planifications) {
      try {
        const datePlan = await this.getDateFromSemaineJour(plan.semaine, plan.jour);
        const datePlanObj = new Date(datePlan);
        
        if (datePlanObj >= dateDebutObj && datePlanObj <= dateFinObj) {
          filtered.push(plan);
        }
      } catch (error) {
        console.error(`Erreur conversion date pour ${plan.semaine}-${plan.jour}:`, error);
      }
    }
    
    planificationsFiltrees = filtered;
    console.log(`Planifications après filtrage période: ${planificationsFiltrees.length}`);
  }

  if (planificationsFiltrees.length === 0) {
    const message = estMemeDate 
      ? `Aucune planification trouvée pour le ${dateDebut}`
      : `Aucune planification trouvée entre ${dateDebut} et ${dateFin}`;
    throw new NotFoundException(message);
  }

  // Grouper par ligne (le reste du code reste inchangé)
  const statsParLigne: Record<string, {
    ligne: string;
    totalQteSource: number;
    totalDecProduction: number;
    totalQtePlanifiee: number;
    causes7M: {
      matierePremiere: number;
      absence: number;
      rendement: number;
      methode: number;
      maintenance: number;
      qualite: number;
      environnement: number;
    };
    referencesMP: string[];
    referencesQualite: string[];
    references: Set<string>;
    detailsReferences: Record<string, any>;
  }> = {};

  const totaux7MGlobaux = {
    matierePremiere: 0,
    absence: 0,
    rendement: 0,
    methode: 0,
    maintenance: 0,
    qualite: 0,
    environnement: 0
  };

  // Parcourir toutes les planifications filtrées
  for (const plan of planificationsFiltrees) {
    const ligne = plan.ligne;
    const quantiteSource = this.getQuantitySource(plan);
    
    // Initialiser la ligne si elle n'existe pas
    if (!statsParLigne[ligne]) {
      statsParLigne[ligne] = {
        ligne,
        totalQteSource: 0,
        totalDecProduction: 0,
        totalQtePlanifiee: 0,
        causes7M: {
          matierePremiere: 0,
          absence: 0,
          rendement: 0,
          methode: 0,
          maintenance: 0,
          qualite: 0,
          environnement: 0
        },
        referencesMP: [],
        referencesQualite: [],
        references: new Set<string>(),
        detailsReferences: {}
      };
    }

    const ligneStats = statsParLigne[ligne];
    
    ligneStats.totalQteSource += quantiteSource;
    ligneStats.totalDecProduction += plan.decProduction;
    ligneStats.totalQtePlanifiee += plan.qtePlanifiee;
    ligneStats.references.add(plan.reference);

    // Initialiser le détail pour cette référence
    if (!ligneStats.detailsReferences[plan.reference]) {
      ligneStats.detailsReferences[plan.reference] = {
        reference: plan.reference,
        of: plan.of || '',
        qtePlanifiee: 0,
        qteModifiee: 0,
        decProduction: 0,
        pcsProd: plan.pcsProd || 0,
        causes7M: {
          matierePremiere: { quantite: 0, reference: '' },
          absence: { quantite: 0, reference: '' },
          rendement: { quantite: 0, reference: '' },
          methode: { quantite: 0, reference: '' },
          maintenance: { quantite: 0, reference: '' },
          qualite: { quantite: 0, reference: '' },
          environnement: { quantite: 0, reference: '' },
          total: 0,
          commentaire: ''
        }
      };
    }

    const refDetail = ligneStats.detailsReferences[plan.reference];
    refDetail.qtePlanifiee += plan.qtePlanifiee;
    refDetail.qteModifiee += plan.qteModifiee;
    refDetail.decProduction += plan.decProduction;

    // Traiter les non-conformités (7M) si elles existent
    if (plan.nonConformites && plan.nonConformites.length > 0) {
      const nonConf = plan.nonConformites[0];
      
      ligneStats.causes7M.matierePremiere += nonConf.matierePremiere;
      ligneStats.causes7M.absence += nonConf.absence;
      ligneStats.causes7M.rendement += nonConf.rendement;
      ligneStats.causes7M.methode += nonConf.methode;
      ligneStats.causes7M.maintenance += nonConf.maintenance;
      ligneStats.causes7M.qualite += nonConf.qualite;
      ligneStats.causes7M.environnement += nonConf.environnement;

      refDetail.causes7M.matierePremiere.quantite += nonConf.matierePremiere;
      refDetail.causes7M.absence.quantite += nonConf.absence;
      refDetail.causes7M.rendement.quantite += nonConf.rendement;
      refDetail.causes7M.methode.quantite += nonConf.methode;
      refDetail.causes7M.maintenance.quantite += nonConf.maintenance;
      refDetail.causes7M.qualite.quantite += nonConf.qualite;
      refDetail.causes7M.environnement.quantite += nonConf.environnement;
      refDetail.causes7M.total += nonConf.total;
      
      if (nonConf.commentaire) {
        refDetail.causes7M.commentaire = nonConf.commentaire;
      }

      if (nonConf.referenceMatierePremiere && nonConf.matierePremiere > 0) {
        const refMP = nonConf.referenceMatierePremiere.trim();
        if (refMP && !ligneStats.referencesMP.includes(refMP)) {
          ligneStats.referencesMP.push(refMP);
        }
        refDetail.causes7M.matierePremiere.reference = refMP;
      }

      if (nonConf.referenceQualite && nonConf.qualite > 0) {
        const refQualite = nonConf.referenceQualite.trim();
        if (refQualite && !ligneStats.referencesQualite.includes(refQualite)) {
          ligneStats.referencesQualite.push(refQualite);
        }
        refDetail.causes7M.qualite.reference = refQualite;
      }

      totaux7MGlobaux.matierePremiere += nonConf.matierePremiere;
      totaux7MGlobaux.absence += nonConf.absence;
      totaux7MGlobaux.rendement += nonConf.rendement;
      totaux7MGlobaux.methode += nonConf.methode;
      totaux7MGlobaux.maintenance += nonConf.maintenance;
      totaux7MGlobaux.qualite += nonConf.qualite;
      totaux7MGlobaux.environnement += nonConf.environnement;
    }
  }

  // Formater les résultats par ligne
  const lignesFormatees = Object.values(statsParLigne).map(ligne => {
    const pcsLigne = ligne.totalQteSource > 0
      ? (ligne.totalDecProduction / ligne.totalQteSource) * 100
      : 0;

    const calculerPourcentage = (valeur: number): number => {
      if (ligne.totalQtePlanifiee <= 0) return 0;
      return Math.round((valeur / ligne.totalQtePlanifiee) * 100 * 10) / 10;
    };

    const detailsReferencesArray = Object.values(ligne.detailsReferences);

    return {
      ligne: ligne.ligne,
      nombreReferences: ligne.references.size,
      production: {
        totalQteSource: ligne.totalQteSource,
        totalDecProduction: ligne.totalDecProduction,
        pcs: Math.round(pcsLigne * 100) / 100
      },
      causes7M: {
        matierePremiere: {
          quantite: ligne.causes7M.matierePremiere,
          pourcentage: calculerPourcentage(ligne.causes7M.matierePremiere),
          references: ligne.referencesMP
        },
        absence: {
          quantite: ligne.causes7M.absence,
          pourcentage: calculerPourcentage(ligne.causes7M.absence)
        },
        rendement: {
          quantite: ligne.causes7M.rendement,
          pourcentage: calculerPourcentage(ligne.causes7M.rendement)
        },
        methode: {
          quantite: ligne.causes7M.methode,
          pourcentage: calculerPourcentage(ligne.causes7M.methode)
        },
        maintenance: {
          quantite: ligne.causes7M.maintenance,
          pourcentage: calculerPourcentage(ligne.causes7M.maintenance)
        },
        qualite: {
          quantite: ligne.causes7M.qualite,
          pourcentage: calculerPourcentage(ligne.causes7M.qualite),
          references: ligne.referencesQualite
        },
        environnement: {
          quantite: ligne.causes7M.environnement,
          pourcentage: calculerPourcentage(ligne.causes7M.environnement)
        }
      },
      detailsReferences: detailsReferencesArray,
      oee: null
    };
  });

  lignesFormatees.sort((a, b) => a.ligne.localeCompare(b.ligne));

  return {
    statsParLigne: lignesFormatees,
    resume7M: this.calculerResume7M(totaux7MGlobaux, lignesFormatees)
  };
}

/**
 * Méthode utilitaire : Calculer les totaux de production globale
 */
private calculerProductionGlobale(statsParLigne: any[]) {
  const totalQteSource = statsParLigne.reduce((sum, ligne) => 
    sum + ligne.production.totalQteSource, 0);
  
  const totalDecProduction = statsParLigne.reduce((sum, ligne) => 
    sum + ligne.production.totalDecProduction, 0);

  const pcsTotal = totalQteSource > 0
    ? Math.round((totalDecProduction / totalQteSource) * 100 * 100) / 100
    : 0;

  return {
    totalQteSource,
    totalDecProduction,
    pcsTotal
  };
}

/**
 * Méthode utilitaire : Calculer le résumé des 7M
 */
private calculerResume7M(totaux7MGlobaux: any, lignesFormatees: any[], referencesGlobales7M?: any) {
  // Calculer la qtePlanifiee totale
  const totalQtePlanifiee = lignesFormatees.reduce((sum, ligne) => {
    return sum + ligne.production.totalQteSource;
  }, 0);

  const calculerPourcentage = (valeur: number): number => {
    if (totalQtePlanifiee <= 0) return 0;
    return Math.round((valeur / totalQtePlanifiee) * 100 * 10) / 10;
  };

  const resume = {
    totaux: {
      matierePremiere: totaux7MGlobaux.matierePremiere,
      absence: totaux7MGlobaux.absence,
      rendement: totaux7MGlobaux.rendement,
      methode: totaux7MGlobaux.methode,
      maintenance: totaux7MGlobaux.maintenance,
      qualite: totaux7MGlobaux.qualite,
      environnement: totaux7MGlobaux.environnement
    },
    pourcentages: {
      matierePremiere: calculerPourcentage(totaux7MGlobaux.matierePremiere),
      absence: calculerPourcentage(totaux7MGlobaux.absence),
      rendement: calculerPourcentage(totaux7MGlobaux.rendement),
      methode: calculerPourcentage(totaux7MGlobaux.methode),
      maintenance: calculerPourcentage(totaux7MGlobaux.maintenance),
      qualite: calculerPourcentage(totaux7MGlobaux.qualite),
      environnement: calculerPourcentage(totaux7MGlobaux.environnement)
    }
  };

  // ✅ NOUVEAU : Ajouter les références globales si fournies
  if (referencesGlobales7M) {
    resume['referencesGlobale'] = {
      matierePremiere: Array.from(referencesGlobales7M.matierePremiere),
      absence: Array.from(referencesGlobales7M.absence),
      rendement: Array.from(referencesGlobales7M.rendement),
      methode: Array.from(referencesGlobales7M.methode),
      maintenance: Array.from(referencesGlobales7M.maintenance),
      qualite: Array.from(referencesGlobales7M.qualite),
      environnement: Array.from(referencesGlobales7M.environnement)
    };
  }

  return resume;
}

/**
 * Méthode utilitaire : Calculer les statistiques du personnel
 */
/**
 * ✅ NOUVELLE VERSION : Calculer les statistiques du personnel en MOYENNE JOURNALIÈRE
 */
private async calculerPersonnelPourPeriode(
  dateDebut: string, 
  dateFin: string,
  estMemeDate: boolean = false
) {
  try {
    console.log(`👥 CALCUL PERSONNEL POUR ${estMemeDate ? 'JOUR UNIQUE' : 'PÉRIODE'}: ${dateDebut} ${estMemeDate ? '' : `à ${dateFin}`}`);
    
    // ✅ ADAPTATION POUR UN JOUR UNIQUE
    if (estMemeDate) {
      // Convertir la date en semaine+jour
      const { semaine, jour } = this.convertirDateEnSemaineEtJour(dateDebut);
      
      console.log(`📅 Date ${dateDebut} → semaine="${semaine}", jour="${jour}"`);
      
      // Récupérer le nombre total d'ouvriers (excl. nomPrenom commençant par 'S')
      const totalOuvriers = await this.calculerTotalOuvriers();
      console.log(`📋 Total ouvriers (excl. S…): ${totalOuvriers}`);

      // A. Compter les PRÉSENCES (rapports de saisie) pour ce jour — DISTINCT matricule
      const rapportsJourResult = await this.saisieRapportRepository
        .createQueryBuilder('rapport')
        .select('COUNT(DISTINCT rapport.matricule)', 'count')
        .where('rapport.semaine = :semaine', { semaine })
        .andWhere('rapport.jour = :jour', { jour })
        .getRawOne();
      const rapportsJour = parseInt(rapportsJourResult?.count ?? '0', 10);

      console.log(`📝 Rapports de saisie trouvés: ${rapportsJour}`);

      // B. Compter les CONGÉS (statut = 'C') pour ce jour
      const congesJour = await this.statutOuvrierRepository
        .createQueryBuilder('statut')
        .where('statut.date = :date', { date: dateDebut })
        .andWhere('statut.statut = :statut', { statut: 'C' })
        .getCount();

      console.log(`🏖️ Congés trouvés: ${congesJour}`);

      // C. Compter les ABSENCES (statut = 'AB') pour ce jour
      const absencesJour = await this.statutOuvrierRepository
        .createQueryBuilder('statut')
        .where('statut.date = :date', { date: dateDebut })
        .andWhere('statut.statut = :statut', { statut: 'AB' })
        .getCount();

      console.log(`❌ Absences trouvées: ${absencesJour}`);

      // ✅ D. MODIFICATION : Compter les SÉLECTIONS (statut = 'S') pour ce jour
      const selectionsJour = await this.statutOuvrierRepository
        .createQueryBuilder('statut')
        .where('statut.date = :date', { date: dateDebut })
        .andWhere('statut.statut = :statut', { statut: 'S' })
        .getCount();

      console.log(`🎯 Sélections (statut S) trouvées: ${selectionsJour}`);

      // E. Calculer le reste (autres statuts ou pas de statut)
      const autres = totalOuvriers - rapportsJour - congesJour - absencesJour - selectionsJour;
      
      const tauxPresence = totalOuvriers > 0
        ? Math.round(((rapportsJour + selectionsJour) / totalOuvriers) * 100 * 10) / 10
        : 0;

      console.log(`📊 RÉSUMÉ ${dateDebut}:`);
      console.log(`   - Présences (saisie): ${rapportsJour}`);
      console.log(`   - Sélections (S): ${selectionsJour}`);
      console.log(`   - Congés: ${congesJour}`);
      console.log(`   - Absences: ${absencesJour}`);
      console.log(`   - Autres/Non définis: ${autres}`);
      console.log(`   - Taux de présence (inclut sélections): ${tauxPresence}%`);

      return {
        totalOuvriers,
        totalPresences: rapportsJour,
        totalSelections: selectionsJour,
        totalConges: congesJour,
        totalAbsences: absencesJour,
        autres: autres,
        moyennePresences: rapportsJour,
        moyenneSelections: selectionsJour,
        moyenneConges: congesJour,
        moyenneAbsences: absencesJour,
        moyenneAutres: autres,
        tauxPresence,
        joursDansPeriode: 1,
        detailsParJour: {
          presences: { [dateDebut]: rapportsJour },
          selections: { [dateDebut]: selectionsJour },
          conges: { [dateDebut]: congesJour },
          absences: { [dateDebut]: absencesJour },
          autres: { [dateDebut]: autres }
        },
        presents: rapportsJour,
        selections: selectionsJour,
        conges: congesJour,
        absents: absencesJour,
        autresStatuts: autres
      };
    }
    
    // Récupérer le nombre total d'ouvriers (excl. nomPrenom commençant par 'S')
    const totalOuvriers = await this.calculerTotalOuvriers();
    
    console.log(`📋 Total ouvriers (excl. S…): ${totalOuvriers}`);

    // Récupérer les semaines dans la période
    const semaines = await this.getSemainesEntreDates(dateDebut, dateFin);
    const joursDansPeriode = this.calculerNombreJoursPeriode(dateDebut, dateFin);
    
    console.log(`📅 Jours dans la période: ${joursDansPeriode} jours`);
    console.log(`📅 Semaines dans la période: ${semaines.length}`);

    // Initialiser les compteurs pour les moyennes
    let totalPresences = 0;
    let totalSelections = 0;
    let totalConges = 0;
    let totalAbsences = 0;
    
    const presencesParJour: { [date: string]: number } = {};
    const selectionsParJour: { [date: string]: number } = {};
    const congesParJour: { [date: string]: number } = {};
    const absencesParJour: { [date: string]: number } = {};

    // Pour chaque semaine, récupérer les données jour par jour
    for (const semaine of semaines) {
      const joursSemaine = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      
      for (const jour of joursSemaine) {
        try {
          const dateReelle = await this.getDateFromSemaineJour(semaine, jour);
          
          // Vérifier si la date est dans la période
          if (!this.dateEstDansPlage(new Date(dateReelle), new Date(dateDebut), new Date(dateFin))) {
            continue;
          }

          // 1. Compter les présences (rapports de saisie) — DISTINCT matricule
          const rapportsJourResult = await this.saisieRapportRepository
            .createQueryBuilder('rapport')
            .select('COUNT(DISTINCT rapport.matricule)', 'count')
            .where('rapport.semaine = :semaine', { semaine })
            .andWhere('rapport.jour = :jour', { jour })
            .getRawOne();
          const rapportsJour = parseInt(rapportsJourResult?.count ?? '0', 10);

          totalPresences += rapportsJour;
          presencesParJour[dateReelle] = rapportsJour;

          // ✅ 2. MODIFICATION : Compter les SÉLECTIONS (statut = 'S') pour ce jour
          const selectionsJour = await this.statutOuvrierRepository
            .createQueryBuilder('statut')
            .where('statut.date = :date', { date: dateReelle })
            .andWhere('statut.statut = :statut', { statut: 'S' })
            .getCount();

          totalSelections += selectionsJour;
          selectionsParJour[dateReelle] = selectionsJour;

          // 3. Compter les congés
          const congesJour = await this.statutOuvrierRepository
            .createQueryBuilder('statut')
            .where('statut.date = :date', { date: dateReelle })
            .andWhere('statut.statut = :statut', { statut: 'C' })
            .getCount();

          totalConges += congesJour;
          congesParJour[dateReelle] = congesJour;

          // 4. Compter les absences
          const absencesJour = await this.statutOuvrierRepository
            .createQueryBuilder('statut')
            .where('statut.date = :date', { date: dateReelle })
            .andWhere('statut.statut = :statut', { statut: 'AB' })
            .getCount();

          totalAbsences += absencesJour;
          absencesParJour[dateReelle] = absencesJour;

          console.log(`📊 ${dateReelle} (${jour}):`);
          console.log(`   - Présences (saisie)=${rapportsJour}`);
          console.log(`   - Sélections (S)=${selectionsJour}`);
          console.log(`   - Congés=${congesJour}`);
          console.log(`   - Absences=${absencesJour}`);

        } catch (error) {
          console.error(`❌ Erreur pour ${semaine}-${jour}:`, error);
          continue;
        }
      }
    }

    // Calculer les MOYENNES journalières
    const moyennePresences = joursDansPeriode > 0 
      ? Math.round((totalPresences / joursDansPeriode) * 10) / 10 
      : 0;
    
    const moyenneSelections = joursDansPeriode > 0
      ? Math.round((totalSelections / joursDansPeriode) * 10) / 10 
      : 0;
    
    const moyenneConges = joursDansPeriode > 0 
      ? Math.round((totalConges / joursDansPeriode) * 10) / 10 
      : 0;
    
    const moyenneAbsences = joursDansPeriode > 0 
      ? Math.round((totalAbsences / joursDansPeriode) * 10) / 10 
      : 0;

    const autres = (totalOuvriers * joursDansPeriode) - totalPresences - totalSelections - totalConges - totalAbsences;
    const moyenneAutres = joursDansPeriode > 0
      ? Math.round((autres / joursDansPeriode) * 10) / 10
      : 0;

    // Taux de présence inclut maintenant les sélections
    const tauxPresence = totalOuvriers > 0 && joursDansPeriode > 0
      ? Math.round(((totalPresences + totalSelections) / (totalOuvriers * joursDansPeriode)) * 100 * 10) / 10
      : 0;

    console.log('📈 RÉSULTATS MOYENNES:');
    console.log(`   Moyenne présences (saisie)/jour: ${moyennePresences}`);
    console.log(`   Moyenne sélections (S)/jour: ${moyenneSelections}`);
    console.log(`   Moyenne congés/jour: ${moyenneConges}`);
    console.log(`   Moyenne absences/jour: ${moyenneAbsences}`);
    console.log(`   Moyenne autres/jour: ${moyenneAutres}`);
    console.log(`   Taux de présence (inclut sélections): ${tauxPresence}%`);

    return {
      totalOuvriers,
      totalPresences,
      totalSelections,
      totalConges,
      totalAbsences,
      autres: autres,
      moyennePresences,
      moyenneSelections,
      moyenneConges,
      moyenneAbsences,
      moyenneAutres,
      tauxPresence,
      joursDansPeriode,
      detailsParJour: {
        presences: presencesParJour,
        selections: selectionsParJour,
        conges: congesParJour,
        absences: absencesParJour
      },
      presents: Math.round(moyennePresences),
      selections: Math.round(moyenneSelections),
      conges: Math.round(moyenneConges),
      absents: Math.round(moyenneAbsences),
      autresStatuts: Math.round(moyenneAutres)
    };

  } catch (error) {
    console.error(`❌ Erreur dans calculerPersonnelPourPeriode:`, error);
    return {
      totalOuvriers: 0,
      totalPresences: 0,
      totalSelections: 0,
      totalConges: 0,
      totalAbsences: 0,
      autres: 0,
      moyennePresences: 0,
      moyenneSelections: 0,
      moyenneConges: 0,
      moyenneAbsences: 0,
      moyenneAutres: 0,
      tauxPresence: 0,
      joursDansPeriode: 0,
      detailsParJour: { 
        presences: {}, 
        selections: {},
        conges: {}, 
        absences: {}, 
        autres: {} 
      },
      presents: 0,
      selections: 0,
      conges: 0,
      absents: 0,
      autresStatuts: 0
    };
  }
}

private async calculerTotalOuvriers(): Promise<number> {
  const result = await this.ouvrierRepository
    .createQueryBuilder('ouvrier')
    .select('COUNT(*)', 'count')
    .where('ouvrier.nomPrenom NOT LIKE :pattern', { 
      pattern: 'S %'  // S majuscule suivi d'un espace
    })
    .getRawOne();
  return parseInt(result?.count ?? '0', 10);
}


/**
 * ✅ Calculer le nombre de jours dans une période
 */
private calculerNombreJoursPeriode(dateDebut: string, dateFin: string): number {
  try {
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    
    // Normaliser les dates (supprimer l'heure)
    const debutNorm = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate());
    const finNorm = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
    
    // Calculer la différence en jours
    const diffTemps = finNorm.getTime() - debutNorm.getTime();
    const diffJours = Math.floor(diffTemps / (1000 * 60 * 60 * 24));
    
    return diffJours + 1; // Inclure le jour de début
  } catch (error) {
    console.error('Erreur calculNombreJoursPeriode:', error);
    return 0;
  }
}

/**
 * ✅ Vérifier si une date est dans une plage
 */
private dateEstDansPlage(date: Date, debut: Date, fin: Date): boolean {
  const dateNorm = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const debutNorm = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate());
  const finNorm = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
  
  return dateNorm >= debutNorm && dateNorm <= finNorm;
}



}