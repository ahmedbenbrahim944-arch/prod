// src/saisie-rapport/saisie-rapport.service.ts
import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaisieRapport } from './entities/saisie-rapport.entity';
import { CreateSaisieRapportDto } from './dto/create-saisie-rapport.dto';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Phase } from '../phase/entities/phase.entity';
import { Planification } from '../semaine/entities/planification.entity';
import { NonConfService } from '../non-conf/non-conf.service';
import { VoirRapportsSemaineDto } from './dto/voir-rapports-semaine.dto';
import { UpdateSaisieRapportDto } from './dto/update-saisie-rapport.dto';


@Injectable()
export class SaisieRapportService {
  constructor(
    @InjectRepository(SaisieRapport)
    private saisieRapportRepository: Repository<SaisieRapport>,
    @InjectRepository(Ouvrier)
    private ouvrierRepository: Repository<Ouvrier>,
    @InjectRepository(Phase)
    private phaseRepository: Repository<Phase>,
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
     private nonConfService: NonConfService,
  ) {}

  /**
   * Créer un nouveau rapport de phase
   */
  // src/saisie-rapport/saisie-rapport.service.ts - Fonction createRapport complète
async createRapport(createSaisieRapportDto: CreateSaisieRapportDto) {
  const { semaine, jour, ligne, matricule, phases } = createSaisieRapportDto;

  console.log('=== DÉBUT CRÉATION RAPPORT PHASE MULTIPLE ===');
  console.log('Données reçues:', { semaine, jour, ligne, matricule, phases });

  // 1. Vérifier si l'ouvrier existe
  const ouvrier = await this.ouvrierRepository.findOne({ 
    where: { matricule } 
  });
  
  if (!ouvrier) {
    throw new NotFoundException(`Ouvrier avec le matricule ${matricule} introuvable`);
  }

  // 2. Vérifier s'il y a une planification pour cette semaine/jour/ligne
  const planificationExiste = await this.planificationRepository.findOne({
    where: { semaine, jour, ligne }
  });

  if (!planificationExiste) {
    throw new BadRequestException(`Aucune planification trouvée pour la semaine "${semaine}", jour "${jour}", ligne "${ligne}"`);
  }

  // 3. RÉCUPÉRER LE PCsProd TOTAL DE LA LIGNE POUR CETTE SEMAINE
  const planificationsLigneSemaine = await this.planificationRepository.find({
    where: { semaine, ligne }
  });

  // Calculer le PCsProd total pour la ligne dans cette semaine
  let totalQteSource = 0;
  let totalDecProduction = 0;
  
  for (const plan of planificationsLigneSemaine) {
    const quantiteSource = plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee;
    totalQteSource += quantiteSource;
    totalDecProduction += plan.decProduction;
  }

  const pcsProdLigne = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;

  console.log(`PCsProd total pour la ligne ${ligne} semaine ${semaine}: ${pcsProdLigne.toFixed(2)}%`);

  // ✅ NOUVEAU : 4. CALCULER LE POURCENTAGE TOTAL DES ÉCARTS POUR CETTE LIGNE
  let pourcentageTotalEcart = 0;
  try {
    // Récupérer toutes les références de cette ligne pour cette semaine
    const planificationsAvecReferences = await this.planificationRepository.find({
      where: { semaine, ligne },
      select: ['reference']
    });

    // Obtenir les références uniques
    const referencesUniques = [...new Set(planificationsAvecReferences.map(p => p.reference))];
    console.log(`Références trouvées pour la ligne ${ligne}:`, referencesUniques);

    // Pour chaque référence, calculer le pourcentage d'écart et faire la moyenne
    if (referencesUniques.length > 0) {
      let totalPourcentages = 0;
      let nbReferencesAvecEcart = 0;

      for (const reference of referencesUniques) {
        try {
          // Utiliser le service non-conf existant
          const resultatEcart = await this.nonConfService.getTotalEcartPourcentage(semaine, ligne, reference);
          
          // ✅ CORRECTION : Extraire le pourcentage selon le type de retour
          let pourcentage = 0;
          
          if (resultatEcart && typeof resultatEcart === 'object') {
            // Vérifier si pourcentageTotalNumber existe (type avec données)
            if ('pourcentageTotalNumber' in resultatEcart && resultatEcart.pourcentageTotalNumber) {
              pourcentage = resultatEcart.pourcentageTotalNumber;
            } 
            // Vérifier si pourcentageTotal existe (type string "32.5%")
            else if ('pourcentageTotal' in resultatEcart && resultatEcart.pourcentageTotal) {
              const pourcentageStr = resultatEcart.pourcentageTotal;
              // Extraire le nombre du string "32.5%"
              const match = pourcentageStr.toString().match(/(\d+(\.\d+)?)/);
              pourcentage = match ? parseFloat(match[0]) : 0;
            }
            // Vérifier si pourcentageTotal existe directement comme number
            else if ('pourcentageTotal' in resultatEcart && typeof resultatEcart.pourcentageTotal === 'number') {
              pourcentage = resultatEcart.pourcentageTotal;
            }
          }
          
          if (pourcentage > 0) {
            totalPourcentages += pourcentage;
            nbReferencesAvecEcart++;
            console.log(`Pourcentage écart pour ${reference}: ${pourcentage}%`);
          }
        } catch (error) {
          console.warn(`Erreur calcul écart pour ${reference}:`, error.message);
        }
      }

      // Calculer la moyenne
      if (nbReferencesAvecEcart > 0) {
        pourcentageTotalEcart = Math.round((totalPourcentages / nbReferencesAvecEcart) * 10) / 10;
      }
    }

    console.log(`Pourcentage total des écarts pour la ligne ${ligne}: ${pourcentageTotalEcart}%`);
  } catch (error) {
    console.error('Erreur calcul pourcentage total écart:', error);
    // Ne pas bloquer la création du rapport si le calcul échoue
  }

  // 5. Vérifier les phases
  for (const phaseHeure of phases) {
    const phaseExiste = await this.phaseRepository.findOne({ 
      where: { ligne, phase: phaseHeure.phase } 
    });
    
    if (!phaseExiste) {
      throw new NotFoundException(`Phase "${phaseHeure.phase}" introuvable pour la ligne "${ligne}"`);
    }
  }

  // 6. Vérifier si cet ouvrier a déjà un rapport ce jour-là
  const rapportExistant = await this.saisieRapportRepository.findOne({
  where: { semaine, jour, ligne, matricule }
});

 if (rapportExistant) {
  throw new ConflictException(
    `Cet ouvrier a déjà un rapport sur la ligne "${ligne}" ce ${jour}. Utilisez la mise à jour ou supprimez le rapport existant.`
  );
}

  // 7. Calculer les totaux
  const totalHeuresNouvelles = phases.reduce((total, phase) => total + phase.heures, 0);
  
  if (totalHeuresNouvelles > 8) {
    throw new BadRequestException(
      `Total des heures (${totalHeuresNouvelles}h) dépasse la limite de 8h par jour`
    );
  }

  // 8. Vérifier le nombre de phases
  if (phases.length > 3) {
    throw new BadRequestException(
      `Nombre de phases (${phases.length}) dépasse la limite de 3 phases par jour`
    );
  }

  try {
    // Créer UN SEUL rapport avec toutes les phases
    const nouveauRapport = new SaisieRapport();
    nouveauRapport.semaine = semaine;
    nouveauRapport.jour = jour;
    nouveauRapport.ligne = ligne;
    nouveauRapport.matricule = matricule;
    nouveauRapport.nomPrenom = ouvrier.nomPrenom;
    nouveauRapport.phases = phases;
    nouveauRapport.totalHeuresJour = totalHeuresNouvelles;
    nouveauRapport.heuresRestantes = 8 - totalHeuresNouvelles;
    nouveauRapport.nbPhasesJour = phases.length;
    nouveauRapport.pcsProdLigne = Math.round(pcsProdLigne * 100) / 100;
    nouveauRapport.pourcentageTotalEcart = pourcentageTotalEcart; // ✅ NOUVEAU : Sauvegarde du pourcentage

    const rapportSauvegarde = await this.saisieRapportRepository.save(nouveauRapport);

    console.log('Rapport créé avec succès:', rapportSauvegarde);

    return {
      message: 'Rapport de phase créé avec succès',
      rapport: {
        id: rapportSauvegarde.id,
        semaine: rapportSauvegarde.semaine,
        jour: rapportSauvegarde.jour,
        ligne: rapportSauvegarde.ligne,
        matricule: rapportSauvegarde.matricule,
        nomPrenom: rapportSauvegarde.nomPrenom,
        phases: rapportSauvegarde.phases,
        totalHeuresJour: rapportSauvegarde.totalHeuresJour,
        heuresRestantes: rapportSauvegarde.heuresRestantes,
        nbPhasesJour: rapportSauvegarde.nbPhasesJour,
        pcsProdLigne: `${rapportSauvegarde.pcsProdLigne}%`,
        pourcentageTotalEcart: `${rapportSauvegarde.pourcentageTotalEcart}%`, // ✅ NOUVEAU : Inclure dans la réponse
        createdAt: rapportSauvegarde.createdAt,
        updatedAt: rapportSauvegarde.updatedAt
      }
    };
  } catch (error) {
    console.error('Erreur création rapport:', error);
    throw new InternalServerErrorException('Erreur lors de la création du rapport de phase');
  }
}

  /**
   * Récupérer tous les rapports
   */
  async findAll() {
    try {
      const rapports = await this.saisieRapportRepository.find({
        order: { semaine: 'DESC', jour: 'ASC', ligne: 'ASC', matricule: 'ASC' }
      });

      return {
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer les rapports par semaine
   */
  async findBySemaine(semaine: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { semaine },
        order: { jour: 'ASC', ligne: 'ASC', matricule: 'ASC' }
      });

      return {
        semaine,
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports par semaine:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

   // Dans saisie-rapport.service.ts - méthode voirRapportsSemaine
async voirRapportsSemaine(semaine: string) {
  try {
    console.log(`=== RÉCUPÉRATION DES RAPPORTS POUR LA SEMAINE: ${semaine} ===`);
    
    const rapports = await this.saisieRapportRepository.find({
      where: { semaine },
      order: { 
        jour: 'ASC',
        ligne: 'ASC',
        matricule: 'ASC'
      }
    });

    if (rapports.length === 0) {
      return {
        message: `Aucun rapport trouvé pour la semaine "${semaine}"`,
        semaine,
        totalRapports: 0,
        rapports: [],
        statistiques: {
          totalHeures: 0,
          totalOuvriers: 0,
          totalLignes: 0,
          moyenneHeuresParOuvrier: 0,
          moyenneEcartPourcentage: 0, // ✅ NOUVEAU
          repartitionParJour: {},
          repartitionParLigne: {}
        }
      };
    }

    // Calculer les statistiques
    const matricules = new Set<number>();
    const lignes = new Set<string>();
    const jours = new Set<string>();
    let totalHeuresSemaine = 0;
    let totalPourcentageEcart = 0;
    let lignesAvecEcart = 0;
    
    const repartitionParJour: Record<string, { rapports: number, heures: number, ouvriers: Set<number> }> = {};
    const repartitionParLigne: Record<string, { rapports: number, heures: number, ouvriers: Set<number>, pourcentageEcart: number }> = {};

    // Traiter chaque rapport
    rapports.forEach(rapport => {
      matricules.add(rapport.matricule);
      lignes.add(rapport.ligne);
      jours.add(rapport.jour);
      totalHeuresSemaine += rapport.totalHeuresJour;
      
      // Accumuler les pourcentages d'écart
      if (rapport.pourcentageTotalEcart > 0) {
        totalPourcentageEcart += rapport.pourcentageTotalEcart;
        lignesAvecEcart++;
      }
      
      // Répartition par jour
      if (!repartitionParJour[rapport.jour]) {
        repartitionParJour[rapport.jour] = {
          rapports: 0,
          heures: 0,
          ouvriers: new Set<number>()
        };
      }
      repartitionParJour[rapport.jour].rapports++;
      repartitionParJour[rapport.jour].heures += rapport.totalHeuresJour;
      repartitionParJour[rapport.jour].ouvriers.add(rapport.matricule);
      
      // Répartition par ligne
      if (!repartitionParLigne[rapport.ligne]) {
        repartitionParLigne[rapport.ligne] = {
          rapports: 0,
          heures: 0,
          ouvriers: new Set<number>(),
          pourcentageEcart: rapport.pourcentageTotalEcart
        };
      } else {
        // Mettre à jour si nécessaire
        repartitionParLigne[rapport.ligne].pourcentageEcart = rapport.pourcentageTotalEcart;
      }
      repartitionParLigne[rapport.ligne].rapports++;
      repartitionParLigne[rapport.ligne].heures += rapport.totalHeuresJour;
      repartitionParLigne[rapport.ligne].ouvriers.add(rapport.matricule);
    });

    // Calculer la moyenne
    const moyenneHeuresParOuvrier = matricules.size > 0 
      ? totalHeuresSemaine / matricules.size 
      : 0;
    
    const moyenneEcartPourcentage = lignesAvecEcart > 0
      ? Math.round((totalPourcentageEcart / lignesAvecEcart) * 10) / 10
      : 0;

    // Formater les rapports
    const rapportsFormates = rapports.map(rapport => ({
      id: rapport.id,
      semaine: rapport.semaine,
      jour: rapport.jour,
      ligne: rapport.ligne,
      matricule: rapport.matricule,
      nomPrenom: rapport.nomPrenom,
      phases: rapport.phases,
      totalHeuresJour: rapport.totalHeuresJour,
      heuresRestantes: rapport.heuresRestantes,
      nbPhasesJour: rapport.nbPhasesJour,
      pcsProdLigne: `${rapport.pcsProdLigne}%`,
      pourcentageTotalEcart: `${rapport.pourcentageTotalEcart}%`, // ✅ NOUVEAU
      createdAt: rapport.createdAt,
      updatedAt: rapport.updatedAt
    }));

    // Formater les statistiques
    const statistiques = {
      totalRapports: rapports.length,
      totalHeures: totalHeuresSemaine,
      totalOuvriers: matricules.size,
      totalLignes: lignes.size,
      totalJours: jours.size,
      moyenneHeuresParOuvrier: Math.round(moyenneHeuresParOuvrier * 100) / 100,
      moyenneEcartPourcentage, // ✅ NOUVEAU
      repartitionParJour: Object.entries(repartitionParJour).reduce((acc, [jour, data]) => {
        acc[jour] = {
          rapports: data.rapports,
          heures: data.heures,
          ouvriers: data.ouvriers.size
        };
        return acc;
      }, {} as Record<string, any>),
      repartitionParLigne: Object.entries(repartitionParLigne).reduce((acc, [ligne, data]) => {
        acc[ligne] = {
          rapports: data.rapports,
          heures: data.heures,
          ouvriers: data.ouvriers.size,
          pourcentageEcart: `${data.pourcentageEcart}%` // ✅ NOUVEAU
        };
        return acc;
      }, {} as Record<string, any>)
    };

    console.log(`=== RAPPORTS RÉCUPÉRÉS: ${rapports.length} pour la semaine ${semaine} ===`);

    return {
      message: `Rapports de la semaine "${semaine}" récupérés avec succès`,
      semaine,
      totalRapports: rapports.length,
      rapports: rapportsFormates,
      statistiques
    };

  } catch (error) {
    console.error('Erreur lors de la récupération des rapports par semaine:', error);
    throw new InternalServerErrorException('Erreur lors de la récupération des rapports de la semaine');
  }
}

  /**
   * Récupérer les rapports par semaine et jour
   */
  async findBySemaineJour(semaine: string, jour: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { semaine, jour },
        order: { ligne: 'ASC', matricule: 'ASC' }
      });

      return {
        semaine,
        jour,
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports par semaine/jour:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer les rapports par matricule
   */
  async findByMatricule(matricule: number) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { matricule },
        order: { semaine: 'DESC', jour: 'ASC' }
      });

      return {
        matricule,
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports par matricule:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer les rapports par ligne
   */
  async findByLigne(ligne: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { ligne },
        order: { semaine: 'DESC', jour: 'ASC', matricule: 'ASC' }
      });

      return {
        ligne,
        total: rapports.length,
        rapports: rapports.map(rapport => ({
          id: rapport.id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule,
          nomPrenom: rapport.nomPrenom,
          phases: rapport.phases,
          totalHeuresJour: rapport.totalHeuresJour,
          heuresRestantes: rapport.heuresRestantes,
          nbPhasesJour: rapport.nbPhasesJour,
          createdAt: rapport.createdAt,
          updatedAt: rapport.updatedAt
        }))
      };
    } catch (error) {
      console.error('Erreur récupération rapports par ligne:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports');
    }
  }

  /**
   * Récupérer un rapport par ID
   */
  async findOne(id: number) {
    const rapport = await this.saisieRapportRepository.findOne({ 
      where: { id } 
    });
    
    if (!rapport) {
      throw new NotFoundException(`Rapport avec l'ID ${id} introuvable`);
    }

    return {
      id: rapport.id,
      semaine: rapport.semaine,
      jour: rapport.jour,
      ligne: rapport.ligne,
      matricule: rapport.matricule,
      nomPrenom: rapport.nomPrenom,
      phases: rapport.phases,
      totalHeuresJour: rapport.totalHeuresJour,
      heuresRestantes: rapport.heuresRestantes,
      nbPhasesJour: rapport.nbPhasesJour,
      createdAt: rapport.createdAt,
      updatedAt: rapport.updatedAt
    };
  }

  /**
   * Mettre à jour un rapport
   */
  async update(id: number, updateSaisieRapportDto: CreateSaisieRapportDto) {
  const rapport = await this.saisieRapportRepository.findOne({ 
    where: { id } 
  });
  
  if (!rapport) {
    throw new NotFoundException(`Rapport avec l'ID ${id} introuvable`);
  }

  const { semaine, jour, ligne, matricule, phases } = updateSaisieRapportDto;

  // Vérifier les phases
  for (const phaseHeure of phases) {
    const phaseExiste = await this.phaseRepository.findOne({ 
      where: { ligne, phase: phaseHeure.phase } 
    });
    
    if (!phaseExiste) {
      throw new NotFoundException(`Phase "${phaseHeure.phase}" introuvable pour la ligne "${ligne}"`);
    }
  }

  // RECALCULER LE PCsProd TOTAL DE LA LIGNE
  const planificationsLigneSemaine = await this.planificationRepository.find({
    where: { semaine, ligne }
  });

  let totalQteSource = 0;
  let totalDecProduction = 0;
  
  for (const plan of planificationsLigneSemaine) {
    const quantiteSource = plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee;
    totalQteSource += quantiteSource;
    totalDecProduction += plan.decProduction;
  }

  const pcsProdLigne = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;

  // Calculer les totaux
  const totalHeuresNouvelles = phases.reduce((total, phase) => total + phase.heures, 0);
  
  if (totalHeuresNouvelles > 8) {
    throw new BadRequestException(
      `Total des heures (${totalHeuresNouvelles}h) dépasse la limite de 8h par jour`
    );
  }

  if (phases.length > 3) {
    throw new BadRequestException(
      `Nombre de phases (${phases.length}) dépasse la limite de 3 phases par jour`
    );
  }

  try {
    // Mettre à jour le rapport
    rapport.semaine = semaine;
    rapport.jour = jour;
    rapport.ligne = ligne;
    rapport.matricule = matricule;
    rapport.phases = phases;
    rapport.totalHeuresJour = totalHeuresNouvelles;
    rapport.heuresRestantes = 8 - totalHeuresNouvelles;
    rapport.nbPhasesJour = phases.length;
    rapport.pcsProdLigne = Math.round(pcsProdLigne * 100) / 100; // Mettre à jour le PCsProd

    const rapportMisAJour = await this.saisieRapportRepository.save(rapport);

    return {
      message: 'Rapport mis à jour avec succès',
      rapport: {
        id: rapportMisAJour.id,
        semaine: rapportMisAJour.semaine,
        jour: rapportMisAJour.jour,
        ligne: rapportMisAJour.ligne,
        matricule: rapportMisAJour.matricule,
        nomPrenom: rapportMisAJour.nomPrenom,
        phases: rapportMisAJour.phases,
        totalHeuresJour: rapportMisAJour.totalHeuresJour,
        heuresRestantes: rapportMisAJour.heuresRestantes,
        nbPhasesJour: rapportMisAJour.nbPhasesJour,
        pcsProdLigne: `${rapportMisAJour.pcsProdLigne}%`,
        updatedAt: rapportMisAJour.updatedAt
      }
    };
  } catch (error) {
    console.error('Erreur mise à jour rapport:', error);
    throw new InternalServerErrorException('Erreur lors de la mise à jour du rapport');
  }
}

  /**
   * Supprimer un rapport
   */
  async remove(id: number) {
    const rapport = await this.saisieRapportRepository.findOne({ 
      where: { id } 
    });
    
    if (!rapport) {
      throw new NotFoundException(`Rapport avec l'ID ${id} introuvable`);
    }

    try {
      await this.saisieRapportRepository.remove(rapport);

      return {
        message: 'Rapport supprimé avec succès',
        rapport: {
          id,
          semaine: rapport.semaine,
          jour: rapport.jour,
          ligne: rapport.ligne,
          matricule: rapport.matricule
        }
      };
    } catch (error) {
      console.error('Erreur suppression rapport:', error);
      throw new InternalServerErrorException('Erreur lors de la suppression du rapport');
    }
  }

  /**
   * Obtenir les statistiques d'un ouvrier pour une semaine
   */
  async getStatsOuvrierSemaine(matricule: number, semaine: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { matricule, semaine },
        order: { jour: 'ASC' }
      });

      const statsParJour = rapports.map(rapport => ({
        jour: rapport.jour,
        totalHeures: rapport.totalHeuresJour,
        nbPhases: rapport.nbPhasesJour,
        ligne: rapport.ligne,
        phases: rapport.phases
      }));

      const totalSemaine = rapports.reduce((total, rapport) => total + rapport.totalHeuresJour, 0);
      const moyenneParJour = rapports.length > 0 ? totalSemaine / rapports.length : 0;

      return {
        matricule,
        semaine,
        statsParJour,
        totalSemaine: {
          totalHeures: totalSemaine,
          moyenneParJour: Math.round(moyenneParJour * 100) / 100,
          nbJours: rapports.length
        }
      };
    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des statistiques');
    }
  }

  /**
   * Obtenir les statistiques globales d'une semaine
   */
  async getStatsSemaine(semaine: string) {
    try {
      const rapports = await this.saisieRapportRepository.find({
        where: { semaine }
      });

      const stats = {
        totalRapports: rapports.length,
        totalOuvriers: new Set(rapports.map(r => r.matricule)).size,
        totalLignes: new Set(rapports.map(r => r.ligne)).size,
        totalHeures: rapports.reduce((total, rapport) => total + rapport.totalHeuresJour, 0),
        statsParJour: {} as any,
        statsParLigne: {} as any
      };

      // Stats par jour
      rapports.forEach(rapport => {
        if (!stats.statsParJour[rapport.jour]) {
          stats.statsParJour[rapport.jour] = {
            totalRapports: 0,
            totalHeures: 0,
            totalOuvriers: new Set()
          };
        }
        stats.statsParJour[rapport.jour].totalRapports++;
        stats.statsParJour[rapport.jour].totalHeures += rapport.totalHeuresJour;
        stats.statsParJour[rapport.jour].totalOuvriers.add(rapport.matricule);
      });

      // Stats par ligne
      rapports.forEach(rapport => {
        if (!stats.statsParLigne[rapport.ligne]) {
          stats.statsParLigne[rapport.ligne] = {
            totalRapports: 0,
            totalHeures: 0,
            totalOuvriers: new Set()
          };
        }
        stats.statsParLigne[rapport.ligne].totalRapports++;
        stats.statsParLigne[rapport.ligne].totalHeures += rapport.totalHeuresJour;
        stats.statsParLigne[rapport.ligne].totalOuvriers.add(rapport.matricule);
      });

      return {
        semaine,
        ...stats
      };
    } catch (error) {
      console.error('Erreur récupération statistiques semaine:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des statistiques');
    }
  }

  async voirRapportsFiltres(semaine: string, jour?: string, ligne?: string) {
    try {
      // Construire les conditions de recherche
      const whereConditions: any = { semaine };
      
      if (jour) {
        whereConditions.jour = jour;
      }
      
      if (ligne) {
        whereConditions.ligne = ligne;
      }

      console.log(`=== RECHERCHE RAPPORTS AVEC FILTRES ===`);
      console.log('Filtres appliqués:', { semaine, jour, ligne });

      const rapports = await this.saisieRapportRepository.find({
        where: whereConditions,
        order: { 
          jour: 'ASC',
          ligne: 'ASC',
          matricule: 'ASC'
        }
      });

      if (rapports.length === 0) {
        let message = `Aucun rapport trouvé pour la semaine "${semaine}"`;
        if (jour) message += `, jour "${jour}"`;
        if (ligne) message += `, ligne "${ligne}"`;
        
        return {
          message,
          semaine,
          jour,
          ligne,
          totalRapports: 0,
          rapports: [],
          statistiques: {
            totalHeures: 0,
            totalOuvriers: 0,
            totalLignes: 0,
            moyenneHeuresParOuvrier: 0,
            moyenneEcartPourcentage: 0,
            repartitionParJour: {},
            repartitionParLigne: {}
          }
        };
      }

      // Calculer les statistiques (similaires à voirRapportsSemaine mais avec filtres)
      const matricules = new Set<number>();
      const lignesSet = new Set<string>();
      const joursSet = new Set<string>();
      let totalHeures = 0;
      let totalPourcentageEcart = 0;
      let lignesAvecEcart = 0;
      
      const repartitionParJour: Record<string, { rapports: number, heures: number, ouvriers: Set<number> }> = {};
      const repartitionParLigne: Record<string, { rapports: number, heures: number, ouvriers: Set<number>, pourcentageEcart: number }> = {};

      rapports.forEach(rapport => {
        matricules.add(rapport.matricule);
        lignesSet.add(rapport.ligne);
        joursSet.add(rapport.jour);
        totalHeures += rapport.totalHeuresJour;
        
        if (rapport.pourcentageTotalEcart > 0) {
          totalPourcentageEcart += rapport.pourcentageTotalEcart;
          lignesAvecEcart++;
        }
        
        // Répartition par jour
        if (!repartitionParJour[rapport.jour]) {
          repartitionParJour[rapport.jour] = {
            rapports: 0,
            heures: 0,
            ouvriers: new Set<number>()
          };
        }
        repartitionParJour[rapport.jour].rapports++;
        repartitionParJour[rapport.jour].heures += rapport.totalHeuresJour;
        repartitionParJour[rapport.jour].ouvriers.add(rapport.matricule);
        
        // Répartition par ligne
        if (!repartitionParLigne[rapport.ligne]) {
          repartitionParLigne[rapport.ligne] = {
            rapports: 0,
            heures: 0,
            ouvriers: new Set<number>(),
            pourcentageEcart: rapport.pourcentageTotalEcart
          };
        } else {
          repartitionParLigne[rapport.ligne].pourcentageEcart = rapport.pourcentageTotalEcart;
        }
        repartitionParLigne[rapport.ligne].rapports++;
        repartitionParLigne[rapport.ligne].heures += rapport.totalHeuresJour;
        repartitionParLigne[rapport.ligne].ouvriers.add(rapport.matricule);
      });

      // Formater les rapports
      const rapportsFormates = rapports.map(rapport => ({
        id: rapport.id,
        semaine: rapport.semaine,
        jour: rapport.jour,
        ligne: rapport.ligne,
        matricule: rapport.matricule,
        nomPrenom: rapport.nomPrenom,
        phases: rapport.phases,
        totalHeuresJour: rapport.totalHeuresJour,
        heuresRestantes: rapport.heuresRestantes,
        nbPhasesJour: rapport.nbPhasesJour,
        pcsProdLigne: `${rapport.pcsProdLigne}%`,
        pourcentageTotalEcart: `${rapport.pourcentageTotalEcart}%`,
        createdAt: rapport.createdAt,
        updatedAt: rapport.updatedAt
      }));

      // Calculer les moyennes
      const moyenneHeuresParOuvrier = matricules.size > 0 
        ? totalHeures / matricules.size 
        : 0;
      
      const moyenneEcartPourcentage = lignesAvecEcart > 0
        ? Math.round((totalPourcentageEcart / lignesAvecEcart) * 10) / 10
        : 0;

      // Formater les statistiques
      const statistiques = {
        totalRapports: rapports.length,
        totalHeures: totalHeures,
        totalOuvriers: matricules.size,
        totalLignes: lignesSet.size,
        totalJours: joursSet.size,
        moyenneHeuresParOuvrier: Math.round(moyenneHeuresParOuvrier * 100) / 100,
        moyenneEcartPourcentage,
        repartitionParJour: Object.entries(repartitionParJour).reduce((acc, [jour, data]) => {
          acc[jour] = {
            rapports: data.rapports,
            heures: data.heures,
            ouvriers: data.ouvriers.size
          };
          return acc;
        }, {} as Record<string, any>),
        repartitionParLigne: Object.entries(repartitionParLigne).reduce((acc, [ligne, data]) => {
          acc[ligne] = {
            rapports: data.rapports,
            heures: data.heures,
            ouvriers: data.ouvriers.size,
            pourcentageEcart: `${data.pourcentageEcart}%`
          };
          return acc;
        }, {} as Record<string, any>)
      };

      return {
        message: `Rapports filtrés récupérés avec succès`,
        semaine,
        jour,
        ligne,
        totalRapports: rapports.length,
        rapports: rapportsFormates,
        statistiques
      };

    } catch (error) {
      console.error('Erreur lors de la récupération des rapports filtrés:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des rapports filtrés');
    }
  }
  async updateRapport(updateSaisieRapportDto: UpdateSaisieRapportDto) {
  const { semaine, jour, ligne, matricule, phases } = updateSaisieRapportDto;

  console.log('=== DÉBUT MISE À JOUR RAPPORT ===');
  console.log('Données reçues:', { semaine, jour, ligne, matricule, phases });

  // 1. Vérifier si l'ouvrier existe
  const ouvrier = await this.ouvrierRepository.findOne({ 
    where: { matricule } 
  });
  
  if (!ouvrier) {
    throw new NotFoundException(`Ouvrier avec le matricule ${matricule} introuvable`);
  }

  // 2. Vérifier s'il y a une planification pour cette semaine/jour/ligne
  const planificationExiste = await this.planificationRepository.findOne({
    where: { semaine, jour, ligne }
  });

  if (!planificationExiste) {
    throw new BadRequestException(`Aucune planification trouvée pour la semaine "${semaine}", jour "${jour}", ligne "${ligne}"`);
  }

  // 3. Vérifier si le rapport existe
  const rapportExistant = await this.saisieRapportRepository.findOne({
    where: { semaine, jour, ligne, matricule }
  });

  if (!rapportExistant) {
    throw new NotFoundException(
      `Rapport introuvable pour semaine: "${semaine}", jour: "${jour}", ligne: "${ligne}", matricule: "${matricule}"`
    );
  }

  // 4. Vérifier les phases
  for (const phaseHeure of phases) {
    const phaseExiste = await this.phaseRepository.findOne({ 
      where: { ligne, phase: phaseHeure.phase } 
    });
    
    if (!phaseExiste) {
      throw new NotFoundException(`Phase "${phaseHeure.phase}" introuvable pour la ligne "${ligne}"`);
    }
  }

  // 5. RECALCULER LE PCsProd TOTAL DE LA LIGNE
  const planificationsLigneSemaine = await this.planificationRepository.find({
    where: { semaine, ligne }
  });

  let totalQteSource = 0;
  let totalDecProduction = 0;
  
  for (const plan of planificationsLigneSemaine) {
    const quantiteSource = plan.qteModifiee > 0 ? plan.qteModifiee : plan.qtePlanifiee;
    totalQteSource += quantiteSource;
    totalDecProduction += plan.decProduction;
  }

  const pcsProdLigne = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;

  console.log(`PCsProd total pour la ligne ${ligne} semaine ${semaine}: ${pcsProdLigne.toFixed(2)}%`);

  // 6. CALCULER LE POURCENTAGE TOTAL DES ÉCARTS
  let pourcentageTotalEcart = 0;
  try {
    const planificationsAvecReferences = await this.planificationRepository.find({
      where: { semaine, ligne },
      select: ['reference']
    });

    const referencesUniques = [...new Set(planificationsAvecReferences.map(p => p.reference))];
    
    if (referencesUniques.length > 0) {
      let totalPourcentages = 0;
      let nbReferencesAvecEcart = 0;

      for (const reference of referencesUniques) {
        try {
          const resultatEcart = await this.nonConfService.getTotalEcartPourcentage(semaine, ligne, reference);
          
          let pourcentage = 0;
          
          if (resultatEcart && typeof resultatEcart === 'object') {
            if ('pourcentageTotalNumber' in resultatEcart && resultatEcart.pourcentageTotalNumber) {
              pourcentage = resultatEcart.pourcentageTotalNumber;
            } 
            else if ('pourcentageTotal' in resultatEcart && resultatEcart.pourcentageTotal) {
              const pourcentageStr = resultatEcart.pourcentageTotal;
              const match = pourcentageStr.toString().match(/(\d+(\.\d+)?)/);
              pourcentage = match ? parseFloat(match[0]) : 0;
            }
            else if ('pourcentageTotal' in resultatEcart && typeof resultatEcart.pourcentageTotal === 'number') {
              pourcentage = resultatEcart.pourcentageTotal;
            }
          }
          
          if (pourcentage > 0) {
            totalPourcentages += pourcentage;
            nbReferencesAvecEcart++;
          }
        } catch (error) {
          console.warn(`Erreur calcul écart pour ${reference}:`, error.message);
        }
      }

      if (nbReferencesAvecEcart > 0) {
        pourcentageTotalEcart = Math.round((totalPourcentages / nbReferencesAvecEcart) * 10) / 10;
      }
    }

    console.log(`Pourcentage total des écarts pour la ligne ${ligne}: ${pourcentageTotalEcart}%`);
  } catch (error) {
    console.error('Erreur calcul pourcentage total écart:', error);
  }

  // 7. Calculer les totaux
  const totalHeuresNouvelles = phases.reduce((total, phase) => total + phase.heures, 0);
  
  if (totalHeuresNouvelles > 8) {
    throw new BadRequestException(
      `Total des heures (${totalHeuresNouvelles}h) dépasse la limite de 8h par jour`
    );
  }

  if (phases.length > 3) {
    throw new BadRequestException(
      `Nombre de phases (${phases.length}) dépasse la limite de 3 phases par jour`
    );
  }

  try {
    // Mettre à jour le rapport existant
    rapportExistant.phases = phases;
    rapportExistant.totalHeuresJour = totalHeuresNouvelles;
    rapportExistant.heuresRestantes = 8 - totalHeuresNouvelles;
    rapportExistant.nbPhasesJour = phases.length;
    rapportExistant.pcsProdLigne = Math.round(pcsProdLigne * 100) / 100;
    rapportExistant.pourcentageTotalEcart = pourcentageTotalEcart;

    const rapportMisAJour = await this.saisieRapportRepository.save(rapportExistant);

    console.log('Rapport mis à jour avec succès:', rapportMisAJour.id);

    return {
      message: 'Rapport mis à jour avec succès',
      rapport: {
        id: rapportMisAJour.id,
        semaine: rapportMisAJour.semaine,
        jour: rapportMisAJour.jour,
        ligne: rapportMisAJour.ligne,
        matricule: rapportMisAJour.matricule,
        nomPrenom: rapportMisAJour.nomPrenom,
        phases: rapportMisAJour.phases,
        totalHeuresJour: rapportMisAJour.totalHeuresJour,
        heuresRestantes: rapportMisAJour.heuresRestantes,
        nbPhasesJour: rapportMisAJour.nbPhasesJour,
        pcsProdLigne: `${rapportMisAJour.pcsProdLigne}%`,
        pourcentageTotalEcart: `${rapportMisAJour.pourcentageTotalEcart}%`,
        createdAt: rapportMisAJour.createdAt,
        updatedAt: rapportMisAJour.updatedAt
      }
    };
  } catch (error) {
    console.error('Erreur mise à jour rapport:', error);
    throw new InternalServerErrorException('Erreur lors de la mise à jour du rapport');
  }
}
// Dans saisie-rapport.service.ts - AJOUTER CETTE MÉTHODE

async findBySemaineJourLigneMatricule(semaine: string, jour: string, ligne: string, matricule: number) {
  try {
    const rapport = await this.saisieRapportRepository.findOne({
      where: { semaine, jour, ligne, matricule }
    });

    if (!rapport) {
      throw new NotFoundException(
        `Rapport introuvable pour semaine: "${semaine}", jour: "${jour}", ligne: "${ligne}", matricule: "${matricule}"`
      );
    }

    return {
      message: 'Rapport trouvé',
      rapport: {
        id: rapport.id,
        semaine: rapport.semaine,
        jour: rapport.jour,
        ligne: rapport.ligne,
        matricule: rapport.matricule,
        nomPrenom: rapport.nomPrenom,
        phases: rapport.phases,
        totalHeuresJour: rapport.totalHeuresJour,
        heuresRestantes: rapport.heuresRestantes,
        nbPhasesJour: rapport.nbPhasesJour,
        pcsProdLigne: `${rapport.pcsProdLigne}%`,
        pourcentageTotalEcart: `${rapport.pourcentageTotalEcart}%`,
        createdAt: rapport.createdAt,
        updatedAt: rapport.updatedAt
      }
    };
  } catch (error) {
    console.error('Erreur récupération rapport par critères:', error);
    throw new InternalServerErrorException('Erreur lors de la récupération du rapport');
  }
}

}