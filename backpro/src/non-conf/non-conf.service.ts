// src/non-conf/non-conf.service.ts
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NonConformite } from './entities/non-conf.entity';
import { Planification } from '../semaine/entities/planification.entity';
import { CreateOrUpdateNonConfDto } from './dto/create-or-update-non-conf.dto';
import { GetNonConfDto } from './dto/get-non-conf.dto';
import { GetNonConfByDateDto } from './dto/get-non-conf-by-date.dto';
import { Commentaire } from 'src/commentaire/entities/commentaire.entity';
import { Ouvrier } from 'src/ouvrier/entities/ouvrier.entity';
import { Phase } from 'src/phase/entities/phase.entity';
import { In as TypeORMIn } from 'typeorm';

@Injectable()
export class NonConfService {
  constructor(
    @InjectRepository(NonConformite)
    private nonConfRepository: Repository<NonConformite>,
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    @InjectRepository(Commentaire)
    private commentaireRepository: Repository<Commentaire>,
     @InjectRepository(Ouvrier) // AJOUTÉ
    private ouvrierRepository: Repository<Ouvrier>,
    @InjectRepository(Phase) // AJOUTÉ
    private phaseRepository: Repository<Phase>
  ) {}

  private getQuantitySource(planification: Planification): number {
    return planification.qteModifiee > 0 ? planification.qteModifiee : planification.qtePlanifiee;
  }

  private calculerEcartPourcentage(total5M: number, quantiteSource: number): number {
    if (quantiteSource <= 0) return 0;
    const pourcentage = (total5M / quantiteSource) * 100;
    return Math.round(pourcentage * 10) / 10;
  }

 private parsePhases(phasesString: string | null): string[] {
  if (!phasesString) return [];
  return phasesString
    .split(',')
    .map(p => p.trim())
    .filter(p => p !== '');
}

  // ==================== NOUVELLE MÉTHODE : NETTOYAGE AUTO ====================
  /**
   * Supprime automatiquement un rapport de non-conformité si deltaProd = 0
   * Appelée depuis semaine.service.ts après mise à jour de decProduction
   */
  async cleanNonConformiteIfNeeded(planificationId: number): Promise<void> {
    try {
      const planification = await this.planificationRepository.findOne({
        where: { id: planificationId },
        relations: ['nonConformites']
      });

      if (!planification) {
        console.log(`[CleanNonConf] Planification ${planificationId} non trouvée`);
        return;
      }

      const quantiteSource = this.getQuantitySource(planification);
      const deltaProd = planification.decProduction - quantiteSource;

      console.log(`[CleanNonConf] Planification ${planificationId}: deltaProd = ${deltaProd}`);

      // Si deltaProd = 0 et un rapport existe, le supprimer
      if (deltaProd === 0 && planification.nonConformites && planification.nonConformites.length > 0) {
        const nonConf = planification.nonConformites[0];
        await this.nonConfRepository.remove(nonConf);
        console.log(`[CleanNonConf] Rapport ${nonConf.id} supprimé automatiquement (deltaProd = 0)`);
      }
    } catch (error) {
      console.error('[CleanNonConf] Erreur:', error.message);
    }
  }

 
async createOrUpdateNonConformite(createOrUpdateNonConfDto: CreateOrUpdateNonConfDto) {
  const { 
    semaine, 
    jour, 
    ligne, 
    reference, 
    referenceMatierePremiere,
    referenceQualite,
    commentaireId,
    commentaire: commentaireLibre,
    matriculesAbsence,
    matriculesRendement,
    absence,
    rendement,
    phasesMaintenance // ✅ NOUVEAU: récupération des phases maintenance
  } = createOrUpdateNonConfDto;

  console.log('=== DÉBUT createOrUpdateNonConformite ===');
  console.log('DTO reçu:', createOrUpdateNonConfDto);

  try {
    // 1. Trouver la planification
    const planification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference },
      relations: ['semaineEntity']
    });

    if (!planification) {
      console.error('Planification non trouvée:', { semaine, jour, ligne, reference });
      throw new NotFoundException('Planification non trouvée');
    }

    console.log('Planification trouvée:', {
      id: planification.id,
      qtePlanifiee: planification.qtePlanifiee,
      qteModifiee: planification.qteModifiee,
      decProduction: planification.decProduction,
      ligne: planification.ligne
    });

    // 2. VALIDATION DES MATRICULES ABSENCE
    const absenceValue = absence || 0;
    if (absenceValue > 0) {
      const validationAbsence = await this.validerMatricules(matriculesAbsence, 'absence');
      if (!validationAbsence.valide) {
        throw new BadRequestException(
          validationAbsence.message || 'Validation des matricules absence échouée'
        );
      }
      console.log('Matricules absence validés:', validationAbsence.matricules);
    } else if (matriculesAbsence && matriculesAbsence.trim() !== '') {
      throw new BadRequestException('Matricules absence fournis mais quantité absence = 0');
    }
    

    // 3. VALIDATION DES MATRICULES RENDEMENT
    const rendementValue = rendement || 0;
    if (rendementValue > 0) {
      const validationRendement = await this.validerMatricules(matriculesRendement, 'rendement');
      if (!validationRendement.valide) {
        throw new BadRequestException(
          validationRendement.message || 'Validation des matricules rendement échouée'
        );
      }
      console.log('Matricules rendement validés:', validationRendement.matricules);
    } else if (matriculesRendement && matriculesRendement.trim() !== '') {
      throw new BadRequestException('Matricules rendement fournis mais quantité rendement = 0');
    }

    // 4. ✅ NOUVEAU: VALIDATION DES PHASES MAINTENANCE
    const maintenance = createOrUpdateNonConfDto.maintenance || 0;
    if (maintenance > 0 && phasesMaintenance && phasesMaintenance.trim() !== '') {
      const validationPhases = await this.validerPhasesMaintenance(
        phasesMaintenance,
        planification.ligne // Utiliser la ligne de la planification
      );
      
      if (!validationPhases.valide) {
        throw new BadRequestException(validationPhases.message);
      }
      
      console.log('Phases maintenance validées:', validationPhases.phases);
    } else if (maintenance > 0) {
      console.log('Maintenance > 0 mais aucune phase sélectionnée (optionnel)');
    }

    // 5. Vérifier les règles métier pour la QUALITÉ
    const qualite = createOrUpdateNonConfDto.qualite || 0;
    
    if (qualite > 0) {
      if (!referenceQualite || referenceQualite.trim() === '') {
        throw new BadRequestException('La référence qualité est obligatoire lorsque la quantité Qualité > 0');
      }
      
      if (!commentaireId) {
        throw new BadRequestException('Un commentaire doit être sélectionné lorsque la quantité Qualité > 0');
      }
      
      const commentaireExiste = await this.commentaireRepository.findOne({
        where: { id: commentaireId }
      });
      
      if (!commentaireExiste) {
        throw new NotFoundException(`Commentaire avec ID ${commentaireId} non trouvé`);
      }
      
      console.log('Commentaire validé:', commentaireExiste.commentaire);
    }

    // 6. Calculer le deltaProd actuel
    const quantiteSource = this.getQuantitySource(planification);
    const deltaProd = planification.decProduction - quantiteSource;

    console.log('Calculs:', {
      quantiteSource,
      decProduction: planification.decProduction,
      deltaProd
    });

    // 7. Vérifier si un rapport existe déjà
    const existingNonConf = await this.nonConfRepository.findOne({
      where: { planification: { id: planification.id } },
      relations: ['planification', 'commentaireObjet']
    });

    // 8. Gestion deltaProd = 0 (suppression automatique)
    if (deltaProd === 0) {
      if (existingNonConf) {
        await this.nonConfRepository.remove(existingNonConf);
        console.log('✅ Rapport supprimé automatiquement (deltaProd = 0)');
        
        return {
          message: 'Rapport de non-conformité supprimé (deltaProd = 0)',
          action: 'auto_deleted',
          data: { 
            semaine, 
            jour, 
            ligne, 
            reference,
            quantiteSource,
            decProduction: planification.decProduction,
            deltaProd: 0,
            ecartPourcentage: 0
          }
        };
      } else {
        console.log('ℹ️ Aucun rapport à créer (deltaProd = 0)');
        throw new BadRequestException('Aucune non-conformité à déclarer (deltaProd = 0)');
      }
    }

    // 9. Vérifier si deltaProd est négatif
    if (deltaProd > 0) {
      console.warn('DeltaProd positif, pas de non-conformité:', deltaProd);
      throw new BadRequestException('Aucune non-conformité à déclarer (deltaProd positif)');
    }

    // 10. Extraire les valeurs du DTO
    const matierePremiere = createOrUpdateNonConfDto.matierePremiere || 0;
    const absenceFinal = absenceValue;
    const rendementFinal = rendementValue;
    const maintenanceFinal = maintenance;
    const qualiteValue = createOrUpdateNonConfDto.qualite || 0;
    const methode = createOrUpdateNonConfDto.methode || 0;
    const environnement = createOrUpdateNonConfDto.environnement || 0;

    console.log('Valeurs extraites du DTO:', {
      matierePremiere,
      absence: absenceFinal,
      matriculesAbsence,
      rendement: rendementFinal,
      matriculesRendement,
      maintenance: maintenanceFinal,
      phasesMaintenance,
      qualite: qualiteValue,
      methode,
      environnement,
      referenceMatierePremiere,
      referenceQualite,
      commentaireId
    });

    // 11. Calculer le total des 7M
    const total7M = matierePremiere + absenceFinal + rendementFinal + methode + maintenanceFinal + qualiteValue + environnement;
    const deltaAbsolu = Math.abs(deltaProd);
    const tolerance = 1;

    console.log('Totaux:', {
      total7M,
      deltaAbsolu,
      difference: Math.abs(total7M - deltaAbsolu)
    });

    // 12. Vérifier la correspondance avec deltaProd
    if (Math.abs(total7M - deltaAbsolu) > tolerance) {
      throw new BadRequestException(
        `Le total des causes (${total7M}) ne correspond pas au deltaProd (${deltaAbsolu}). ` +
        `Différence: ${Math.abs(total7M - deltaAbsolu)}`
      );
    }

    // 13. Calculer le pourcentage d'écart
    const ecartPourcentage = this.calculerEcartPourcentage(total7M, quantiteSource);
    console.log('Pourcentage d\'écart calculé:', ecartPourcentage + '%');

    const isUpdate = !!existingNonConf;
    console.log(isUpdate ? 'Mise à jour de rapport existant' : 'Création nouveau rapport');

    // 14. Gestion du total = 0 (suppression)
    if (total7M === 0) {
      if (isUpdate) {
        await this.nonConfRepository.remove(existingNonConf);
        console.log('Rapport supprimé (toutes valeurs à 0)');
        return {
          message: 'Rapport de non-conformité supprimé (toutes les valeurs sont à 0)',
          action: 'deleted',
          data: { 
            semaine, 
            jour, 
            ligne, 
            reference,
            quantiteSource,
            decProduction: planification.decProduction,
            deltaProd,
            ecartPourcentage: 0
          }
        };
      } else {
        throw new BadRequestException('Impossible de créer un rapport avec toutes les valeurs à 0');
      }
    }

    // 15. Créer ou mettre à jour l'entité
    let nonConf: NonConformite;
    
    if (isUpdate) {
      nonConf = existingNonConf;
      console.log('Rapport existant trouvé, ID:', nonConf.id);
    } else {
      nonConf = new NonConformite();
      nonConf.planification = planification;
      console.log('Nouveau rapport créé');
    }
    
    // 16. Mettre à jour les champs de quantité
    nonConf.matierePremiere = matierePremiere;
    nonConf.absence = absenceFinal;
    nonConf.rendement = rendementFinal;
    nonConf.maintenance = maintenanceFinal;
    nonConf.qualite = qualiteValue;
    nonConf.methode = methode;
    nonConf.environnement = environnement;
    nonConf.total = total7M;
    nonConf.ecartPourcentage = ecartPourcentage;
    
    // 17. Gestion des matricules
    if (absenceFinal > 0 && matriculesAbsence && matriculesAbsence.trim() !== '') {
      nonConf.matriculesAbsence = matriculesAbsence.trim();
      console.log('Matricules absence sauvegardés:', nonConf.matriculesAbsence);
    } else {
      nonConf.matriculesAbsence = null;
      console.log('Matricules absence mis à null');
    }
    
    if (rendementFinal > 0 && matriculesRendement && matriculesRendement.trim() !== '') {
      nonConf.matriculesRendement = matriculesRendement.trim();
      console.log('Matricules rendement sauvegardés:', nonConf.matriculesRendement);
    } else {
      nonConf.matriculesRendement = null;
      console.log('Matricules rendement mis à null');
    }
    
    // 18. ✅ NOUVEAU: Gestion des phases maintenance
    if (maintenanceFinal > 0 && phasesMaintenance && phasesMaintenance.trim() !== '') {
      nonConf.phasesMaintenance = phasesMaintenance.trim();
      console.log('Phases maintenance sauvegardées:', nonConf.phasesMaintenance);
    } else {
      nonConf.phasesMaintenance = null;
      console.log('Phases maintenance mises à null');
    }
    
    // 19. Gestion de la référence matière première
    if (matierePremiere > 0 && referenceMatierePremiere && referenceMatierePremiere.trim() !== '') {
      nonConf.referenceMatierePremiere = referenceMatierePremiere;
      console.log('Référence MP définie:', referenceMatierePremiere);
    } else {
      nonConf.referenceMatierePremiere = null;
      console.log('Référence MP mise à null');
    }
    
    // 20. Gestion de la référence qualité
    if (qualiteValue > 0 && referenceQualite && referenceQualite.trim() !== '') {
      nonConf.referenceQualite = referenceQualite;
      console.log('Référence Qualité définie:', referenceQualite);
    } else {
      nonConf.referenceQualite = null;
      console.log('Référence Qualité mise à null');
    }
    
    // 21. Gestion du COMMENTAIRE
    if (commentaireId && qualiteValue > 0) {
      const commentaire = await this.commentaireRepository.findOne({
        where: { id: commentaireId }
      });
      
      if (commentaire) {
        nonConf.commentaireObjet = commentaire;
        console.log('Commentaire associé:', commentaire.commentaire);
      } else {
        nonConf.commentaireObjet = null;
        console.warn('Commentaire non trouvé, mise à null');
      }
    } else {
      nonConf.commentaireObjet = null;
      console.log('Pas de commentaire associé');
    }
    
    // 22. Gestion du commentaire libre
    if (commentaireLibre !== undefined && commentaireLibre !== null) {
      nonConf.commentaire = commentaireLibre.trim() !== '' ? commentaireLibre : null;
      console.log('Commentaire libre défini:', commentaireLibre);
    } else if (!isUpdate) {
      nonConf.commentaire = null;
    }

    nonConf.updatedAt = new Date();

    console.log('Entité avant sauvegarde:', {
      matierePremiere: nonConf.matierePremiere,
      referenceMatierePremiere: nonConf.referenceMatierePremiere,
      absence: nonConf.absence,
      matriculesAbsence: nonConf.matriculesAbsence,
      rendement: nonConf.rendement,
      matriculesRendement: nonConf.matriculesRendement,
      maintenance: nonConf.maintenance,
      phasesMaintenance: nonConf.phasesMaintenance, // ✅ NOUVEAU
      qualite: nonConf.qualite,
      referenceQualite: nonConf.referenceQualite,
      methode: nonConf.methode,
      environnement: nonConf.environnement,
      commentaireId: nonConf.commentaireObjet?.id,
      commentaireTexte: nonConf.commentaireObjet?.commentaire,
      commentaireLibre: nonConf.commentaire,
      total: nonConf.total,
      ecartPourcentage: nonConf.ecartPourcentage
    });

    // 23. Sauvegarder
    const savedNonConf = await this.nonConfRepository.save(nonConf);
    
    console.log('Sauvegarde réussie, ID:', savedNonConf.id);

    // 24. Charger les relations pour la réponse
    const nonConfWithRelations = await this.nonConfRepository.findOne({
      where: { id: savedNonConf.id },
      relations: ['commentaireObjet', 'planification']
    });

    if (!nonConfWithRelations) {
      throw new InternalServerErrorException('Erreur lors de la récupération du rapport sauvegardé');
    }

    // 25. Préparer la réponse
    const actionMessage = isUpdate ? 'mis à jour' : 'créé';
    
    // Fonction pour parser les matricules
    const parseMatricules = (matriculesString: string | null): number[] => {
      if (!matriculesString) return [];
      return matriculesString
        .split(',')
        .map(m => m.trim())
        .filter(m => m !== '')
        .map(m => parseInt(m, 10))
        .filter(m => !isNaN(m));
    };

    // ✅ NOUVEAU: Fonction pour parser les phases maintenance
    const parsePhases = (phasesString: string | null): string[] => {
      if (!phasesString) return [];
      return phasesString
        .split(',')
        .map(p => p.trim())
        .filter(p => p !== '');
    };

    const response = {
      message: `Rapport de non-conformité ${actionMessage} avec succès`,
      action: isUpdate ? 'updated' : 'created',
      data: {
        id: nonConfWithRelations.id,
        semaine,
        jour,
        ligne,
        reference,
        quantiteSource,
        decProduction: planification.decProduction,
        deltaProd,
        total7M: nonConfWithRelations.total,
        ecartPourcentage: nonConfWithRelations.ecartPourcentage,
        details: {
          matierePremiere: nonConfWithRelations.matierePremiere,
          referenceMatierePremiere: nonConfWithRelations.referenceMatierePremiere,
          absence: nonConfWithRelations.absence,
          matriculesAbsence: parseMatricules(nonConfWithRelations.matriculesAbsence),
          rendement: nonConfWithRelations.rendement,
          matriculesRendement: parseMatricules(nonConfWithRelations.matriculesRendement),
          maintenance: nonConfWithRelations.maintenance,
          phasesMaintenance: parsePhases(nonConfWithRelations.phasesMaintenance), // ✅ NOUVEAU
          qualite: nonConfWithRelations.qualite,
          methode: nonConfWithRelations.methode,
          environnement: nonConfWithRelations.environnement,
          referenceQualite: nonConfWithRelations.referenceQualite,
          commentaire: nonConfWithRelations.commentaireObjet 
            ? {
                id: nonConfWithRelations.commentaireObjet.id,
                texte: nonConfWithRelations.commentaireObjet.commentaire
              }
            : null
        },
        commentaireLibre: nonConfWithRelations.commentaire || null,
        createdAt: isUpdate 
          ? (existingNonConf?.createdAt || nonConfWithRelations.createdAt)
          : nonConfWithRelations.createdAt,
        updatedAt: nonConfWithRelations.updatedAt
      }
    };

    console.log('=== FIN createOrUpdateNonConformite - Succès ===');
    return response;

  } catch (error) {
    console.error('=== ERREUR dans createOrUpdateNonConformite ===');
    console.error('Erreur:', error);
    console.error('Stack:', error.stack);
    console.error('DTO qui a causé l\'erreur:', createOrUpdateNonConfDto);
    
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    
    throw new InternalServerErrorException(
      `Erreur lors de la sauvegarde du rapport: ${error.message}`
    );
  }
}

private async validerMatricules(
  matriculesString: string | undefined, 
  type: 'absence' | 'rendement'
): Promise<{ valide: boolean; message?: string; matricules?: number[] }> {
  try {
    console.log(`Validation temporaire des matricules ${type}:`, matriculesString);
    
    // TEMPORAIRE: Accepte tous les matricules sans validation
    if (!matriculesString || matriculesString.trim() === '') {
      return { valide: true, matricules: [] };
    }

    // Convertir la chaîne en tableau de nombres
    const matriculesArray = matriculesString
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== '')
      .map(m => {
        const num = parseInt(m, 10);
        return isNaN(num) ? 0 : num; // Accepte même si invalide
      })
      .filter(m => m > 0); // Filtre les valeurs valides

    console.log(`Matricules ${type} acceptés temporairement:`, matriculesArray);
    
    return { valide: true, matricules: matriculesArray };
  } catch (error) {
    console.error(`Erreur validation temporaire matricules ${type}:`, error);
    return { valide: true, matricules: [] }; // Accepte même en cas d'erreur
  }
}

async getNonConformites(getNonConfDto: GetNonConfDto) {
  const { semaine, jour, ligne, reference } = getNonConfDto;
  
  const queryBuilder = this.nonConfRepository
    .createQueryBuilder('nonConf')
    .leftJoinAndSelect('nonConf.planification', 'planification')
    .leftJoinAndSelect('nonConf.commentaireObjet', 'commentaireObjet') // AJOUTÉ pour avoir le commentaire
    .orderBy('nonConf.createdAt', 'DESC');

  if (semaine) {
    queryBuilder.andWhere('planification.semaine = :semaine', { semaine });
  }
  
  if (jour) {
    queryBuilder.andWhere('planification.jour = :jour', { jour });
  }
  
  if (ligne) {
    queryBuilder.andWhere('planification.ligne = :ligne', { ligne });
  }
  
  if (reference) {
    queryBuilder.andWhere('planification.reference = :reference', { reference });
  }

  const nonConfs = await queryBuilder.getMany();

  // Fonction pour parser les matricules
  const parseMatricules = (matriculesString: string | null): number[] => {
    if (!matriculesString) return [];
    return matriculesString
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== '')
      .map(m => parseInt(m, 10))
      .filter(m => !isNaN(m));
  };

  // Fonction pour récupérer les infos ouvriers (optionnel)
  const getInfosOuvriers = async (matricules: number[]) => {
    if (matricules.length === 0) return [];
    
    const ouvriers = await this.ouvrierRepository.find({
      where: { matricule: In(matricules) }
    });
    
    return ouvriers.map(ouvrier => ({
      matricule: ouvrier.matricule,
      nomPrenom: ouvrier.nomPrenom
    }));
  };

  const formattedResults = await Promise.all(nonConfs.map(async (nonConf) => {
    const plan = nonConf.planification;
    const quantiteSource = this.getQuantitySource(plan);
    
    const ecartPourcentage = nonConf.ecartPourcentage > 0 
      ? nonConf.ecartPourcentage 
      : this.calculerEcartPourcentage(nonConf.total, quantiteSource);
    
    // Récupérer les matricules
    const matriculesAbsence = parseMatricules(nonConf.matriculesAbsence);
    const matriculesRendement = parseMatricules(nonConf.matriculesRendement);
    
    // Récupérer les infos ouvriers (optionnel)
    const infosAbsence = await getInfosOuvriers(matriculesAbsence);
    const infosRendement = await getInfosOuvriers(matriculesRendement);

    return {
      id: nonConf.id,
      semaine: plan.semaine,
      jour: plan.jour,
      ligne: plan.ligne,
      reference: plan.reference,
      of: plan.of,
      quantiteSource,
      decProduction: plan.decProduction,
      deltaProd: plan.deltaProd,
      pcsProd: `${plan.pcsProd}%`,
      total7M: nonConf.total,
      ecartPourcentage,
      details: {
        matierePremiere: nonConf.matierePremiere,
        referenceMatierePremiere: nonConf.referenceMatierePremiere,
        absence: nonConf.absence,
        matriculesAbsence: matriculesAbsence,
        infosAbsence: infosAbsence, // Optionnel: infos complètes
        rendement: nonConf.rendement,
        matriculesRendement: matriculesRendement,
        infosRendement: infosRendement, // Optionnel: infos complètes
        maintenance: nonConf.maintenance,
        qualite: nonConf.qualite,
        methode: nonConf.methode,
        environnement: nonConf.environnement,
        referenceQualite: nonConf.referenceQualite
      },
      commentaire: nonConf.commentaire,
      commentaireObjet: nonConf.commentaireObjet ? {
        id: nonConf.commentaireObjet.id,
        texte: nonConf.commentaireObjet.commentaire
      } : null,
      createdAt: nonConf.createdAt,
      updatedAt: nonConf.updatedAt
    };
  }));

  // Calcul des totaux
  const totals = {
    matierePremiere: formattedResults.reduce((sum, item) => sum + item.details.matierePremiere, 0),
    absence: formattedResults.reduce((sum, item) => sum + item.details.absence, 0),
    rendement: formattedResults.reduce((sum, item) => sum + item.details.rendement, 0),
    maintenance: formattedResults.reduce((sum, item) => sum + item.details.maintenance, 0),
    methode: formattedResults.reduce((sum, item) => sum + item.details.methode, 0),
    qualite: formattedResults.reduce((sum, item) => sum + item.details.qualite, 0),
    environnement: formattedResults.reduce((sum, item) => sum + item.details.environnement, 0),
    total7M: formattedResults.reduce((sum, item) => sum + item.total7M, 0),
    moyenneEcartPourcentage: formattedResults.length > 0 
      ? Math.round((formattedResults.reduce((sum, item) => sum + item.ecartPourcentage, 0) / formattedResults.length) * 10) / 10
      : 0
  };

  // Statistiques par matricule (optionnel)
  const statistiquesMatricules = {
    absence: {},
    rendement: {}
  };

  // Compter les occurrences par matricule (optionnel)
  formattedResults.forEach(item => {
    item.details.matriculesAbsence.forEach(matricule => {
      if (!statistiquesMatricules.absence[matricule]) {
        statistiquesMatricules.absence[matricule] = 0;
      }
      statistiquesMatricules.absence[matricule]++;
    });
    
    item.details.matriculesRendement.forEach(matricule => {
      if (!statistiquesMatricules.rendement[matricule]) {
        statistiquesMatricules.rendement[matricule] = 0;
      }
      statistiquesMatricules.rendement[matricule]++;
    });
  });

  return {
    message: 'Rapports de non-conformité récupérés',
    filters: { semaine, jour, ligne, reference },
    total: formattedResults.length,
    totals,
    statistiquesMatricules, // Optionnel
    rapports: formattedResults
  };
}

 async getNonConformiteById(id: number) {
  const nonConf = await this.nonConfRepository.findOne({
    where: { id },
    relations: ['planification', 'commentaireObjet']
  });

  if (!nonConf) {
    throw new NotFoundException('Rapport de non-conformité non trouvé');
  }

  const planification = nonConf.planification;
  const quantiteSource = this.getQuantitySource(planification);

  // Parser les matricules
  const parseMatricules = (matriculesString: string | null): number[] => {
    if (!matriculesString) return [];
    return matriculesString
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== '')
      .map(m => parseInt(m, 10))
      .filter(m => !isNaN(m));
  };

  return {
    id: nonConf.id,
    semaine: planification.semaine,
    jour: planification.jour,
    ligne: planification.ligne,
    reference: planification.reference,
    of: planification.of,
    quantiteSource,
    decProduction: planification.decProduction,
    deltaProd: planification.deltaProd,
    pcsProd: `${planification.pcsProd}%`,
    total7M: nonConf.total,
    ecartPourcentage: nonConf.ecartPourcentage,
    details: {
      matierePremiere: nonConf.matierePremiere,
      referenceMatierePremiere: nonConf.referenceMatierePremiere,
      absence: nonConf.absence,
      matriculesAbsence: parseMatricules(nonConf.matriculesAbsence),
      rendement: nonConf.rendement,
      matriculesRendement: parseMatricules(nonConf.matriculesRendement),
      maintenance: nonConf.maintenance,
       phasesMaintenance: this.parsePhases(nonConf.phasesMaintenance), 
      qualite: nonConf.qualite,
      methode: nonConf.methode,
      environnement: nonConf.environnement,
      referenceQualite: nonConf.referenceQualite
    },
    commentaire: nonConf.commentaire,
    commentaireObjet: nonConf.commentaireObjet ? {
      id: nonConf.commentaireObjet.id,
      texte: nonConf.commentaireObjet.commentaire
    } : null,
    createdAt: nonConf.createdAt,
    updatedAt: nonConf.updatedAt
  };
}

 async getNonConformiteByCriteria(semaine: string, jour: string, ligne: string, reference: string) {
  const planification = await this.planificationRepository.findOne({
    where: { semaine, jour, ligne, reference }
  });

  if (!planification) {
    throw new NotFoundException('Planification non trouvée');
  }

  const nonConf = await this.nonConfRepository.findOne({
    where: { planification: { id: planification.id } },
    relations: ['planification', 'commentaireObjet']
  });

  const quantiteSource = this.getQuantitySource(planification);
  

  // Parser les matricules
  const parseMatricules = (matriculesString: string | null): number[] => {
    if (!matriculesString) return [];
    return matriculesString
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== '')
      .map(m => parseInt(m, 10))
      .filter(m => !isNaN(m));
  };

  if (!nonConf) {
    return {
      message: 'Aucun rapport de non-conformité trouvé',
      exists: false,
      planification: {
        semaine,
        jour,
        ligne,
        reference,
        quantiteSource,
        decProduction: planification.decProduction,
        deltaProd: planification.deltaProd,
        pcsProd: `${planification.pcsProd}%`,
        ecartPourcentage: 0
      }
    };
  }
  

  return {
    message: 'Rapport de non-conformité trouvé',
    exists: true,
    data: {
      id: nonConf.id,
      semaine: planification.semaine,
      jour: planification.jour,
      ligne: planification.ligne,
      reference: planification.reference,
      of: planification.of,
      quantiteSource,
      decProduction: planification.decProduction,
      deltaProd: planification.deltaProd,
      pcsProd: `${planification.pcsProd}%`,
      total7M: nonConf.total,
      ecartPourcentage: nonConf.ecartPourcentage,
      details: {
        matierePremiere: nonConf.matierePremiere,
        referenceMatierePremiere: nonConf.referenceMatierePremiere,
        absence: nonConf.absence,
        matriculesAbsence: parseMatricules(nonConf.matriculesAbsence),
        rendement: nonConf.rendement,
        matriculesRendement: parseMatricules(nonConf.matriculesRendement),
        maintenance: nonConf.maintenance,
        phasesMaintenance: this.parsePhases(nonConf.phasesMaintenance),
        methode: nonConf.methode,
        qualite: nonConf.qualite,
        environnement: nonConf.environnement,
        referenceQualite: nonConf.referenceQualite,
        commentaire: nonConf.commentaireObjet 
          ? {
              id: nonConf.commentaireObjet.id,
              texte: nonConf.commentaireObjet.commentaire
            }
          : null
      },
      
      commentaireObjet: nonConf.commentaireObjet 
        ? {
            id: nonConf.commentaireObjet.id,
            commentaire: nonConf.commentaireObjet.commentaire
          }
        : null,
      commentaire: nonConf.commentaire,
      createdAt: nonConf.createdAt,
      updatedAt: nonConf.updatedAt
    }
  };
}

  async deleteNonConformite(id: number) {
    const nonConf = await this.nonConfRepository.findOne({
      where: { id }
    });

    if (!nonConf) {
      throw new NotFoundException('Rapport de non-conformité non trouvé');
    }

    await this.nonConfRepository.remove(nonConf);

    return {
      message: 'Rapport de non-conformité supprimé',
      id
    };
  }

  async deleteNonConformiteByCriteria(semaine: string, jour: string, ligne: string, reference: string) {
    const planification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference }
    });

    if (!planification) {
      throw new NotFoundException('Planification non trouvée');
    }

    const nonConf = await this.nonConfRepository.findOne({
      where: { planification: { id: planification.id } }
    });

    if (!nonConf) {
      throw new NotFoundException('Rapport de non-conformité non trouvé');
    }

    await this.nonConfRepository.remove(nonConf);

    return {
      message: 'Rapport de non-conformité supprimé',
      semaine,
      jour,
      ligne,
      reference
    };
  }
private async validerPhasesMaintenance(
  phasesString: string,
  ligne: string
): Promise<{ valide: boolean; message?: string; phases?: string[] }> {
  try {
    console.log(`Validation des phases maintenance pour la ligne ${ligne}:`, phasesString);
    
    if (!phasesString || phasesString.trim() === '') {
      return { valide: true, phases: [] };
    }

    // Convertir la chaîne en tableau de strings
    const phasesArray = phasesString
      .split(',')
      .map(p => p.trim())
      .filter(p => p !== '');

    if (phasesArray.length === 0) {
      return { valide: true, phases: [] };
    }

    console.log('Phases à valider:', phasesArray);

    // Utiliser TypeORMIn au lieu de In
    const phasesExistantes = await this.phaseRepository.find({
      where: {
        ligne: ligne,
        phase: TypeORMIn(phasesArray)
      }
    });

    const phasesTrouvees = phasesExistantes.map(p => p.phase);
    const phasesManquantes = phasesArray.filter(p => !phasesTrouvees.includes(p));

    if (phasesManquantes.length > 0) {
      console.warn(`Phases non trouvées pour la ligne ${ligne}:`, phasesManquantes);
      return {
        valide: false,
        message: `Les phases suivantes n'existent pas pour la ligne ${ligne}: ${phasesManquantes.join(', ')}`
      };
    }

    console.log('Toutes les phases sont valides:', phasesTrouvees);
    return { 
      valide: true, 
      phases: phasesArray 
    };

  } catch (error) {
    console.error('Erreur validation phases maintenance:', error);
    return { 
      valide: false, 
      message: `Erreur lors de la validation des phases: ${error.message}`
    };
  }
}

  async getStats(semaine?: string) {
    const queryBuilder = this.nonConfRepository
      .createQueryBuilder('nonConf')
      .leftJoinAndSelect('nonConf.planification', 'planification');

    if (semaine) {
      queryBuilder.where('planification.semaine = :semaine', { semaine });
    }

    const nonConfs = await queryBuilder.getMany();
    const total = nonConfs.length;

    const statsParCause = {
      matierePremiere: nonConfs.reduce((sum, nc) => sum + nc.matierePremiere, 0),
      absence: nonConfs.reduce((sum, nc) => sum + nc.absence, 0),
      rendement: nonConfs.reduce((sum, nc) => sum + nc.rendement, 0),
      methode: nonConfs.reduce((sum, nc) => sum + nc.methode, 0),
      maintenance: nonConfs.reduce((sum, nc) => sum + nc.maintenance, 0),
      qualite: nonConfs.reduce((sum, nc) => sum + nc.qualite, 0),
       environnement: nonConfs.reduce((sum, nc) => sum + nc.environnement, 0),
      total7M: nonConfs.reduce((sum, nc) => sum + nc.total, 0)
    };

    const rapportsParSemaine = await this.nonConfRepository
      .createQueryBuilder('nonConf')
      .leftJoin('nonConf.planification', 'planification')
      .select('planification.semaine', 'semaine')
      .addSelect('COUNT(nonConf.id)', 'nombreRapports')
      .addSelect('SUM(nonConf.total)', 'totalQuantite')
      .addSelect('AVG(nonConf.ecartPourcentage)', 'moyenneEcartPourcentage')
      .groupBy('planification.semaine')
      .orderBy('planification.semaine', 'DESC')
      .getRawMany();

    const moyenneGlobaleEcart = nonConfs.length > 0
      ? Math.round((nonConfs.reduce((sum, nc) => sum + nc.ecartPourcentage, 0) / nonConfs.length) * 10) / 10
      : 0;

    return {
      message: 'Statistiques des non-conformités',
      periode: semaine || 'Toutes semaines',
      totalRapports: total,
      statsParCause,
      rapportsParSemaine,
      moyenneEcartPourcentage: moyenneGlobaleEcart
    };
  }

  async getTotalEcartPourcentage(semaine: string, ligne: string, reference: string) {
    try {
      console.log('=== DÉBUT getTotalEcartPourcentage ===');
      console.log('Paramètres:', { semaine, ligne, reference });

      const planifications = await this.planificationRepository.find({
        where: { semaine, ligne, reference },
        relations: ['nonConformites']
      });

      if (!planifications || planifications.length === 0) {
        console.log('Aucune planification trouvée');
        return {
          message: 'Aucune planification trouvée pour cette combinaison',
          semaine,
          ligne,
          reference,
          totalEcart: 0,
          totalQuantite: 0,
          pourcentageTotal: 0,
          details: []
        };
      }

      console.log(`Nombre de planifications trouvées: ${planifications.length}`);

      const details = planifications.map(planification => {
        const quantiteSource = planification.qteModifiee > 0 
          ? planification.qteModifiee 
          : planification.qtePlanifiee;
        
        let ecart = 0;
        let nonConfId: number | null = null;
        
        if (planification.nonConformites && planification.nonConformites.length > 0) {
          const nonConf = planification.nonConformites[0];
          ecart = nonConf.total;
          nonConfId = nonConf.id;
        }
        
        const pourcentageJour = quantiteSource > 0 
          ? Math.round((ecart / quantiteSource) * 100 * 10) / 10 
          : 0;

        return {
          jour: planification.jour,
          planificationId: planification.id,
          nonConfId,
          qtePlanifiee: planification.qtePlanifiee,
          qteModifiee: planification.qteModifiee,
          quantiteSource,
          decProduction: planification.decProduction,
          deltaProd: planification.deltaProd,
          ecart,
          pourcentageJour
        };
      });

      const totalEcart = details.reduce((sum, item) => sum + item.ecart, 0);
      const totalQuantite = details.reduce((sum, item) => sum + item.quantiteSource, 0);
      const pourcentageTotal = totalQuantite > 0 
        ? Math.round((totalEcart / totalQuantite) * 100 * 10) / 10 
        : 0;

      console.log('Calculs finaux:', {
        totalEcart,
        totalQuantite,
        pourcentageTotal
      });

      const nonConfs = await this.nonConfRepository
        .createQueryBuilder('nonConf')
        .leftJoin('nonConf.planification', 'planification')
        .where('planification.semaine = :semaine', { semaine })
        .andWhere('planification.ligne = :ligne', { ligne })
        .andWhere('planification.reference = :reference', { reference })
        .getMany();

      const repartitionParCause = {
        matierePremiere: nonConfs.reduce((sum, nc) => sum + nc.matierePremiere, 0),
        absence: nonConfs.reduce((sum, nc) => sum + nc.absence, 0),
        rendement: nonConfs.reduce((sum, nc) => sum + nc.rendement, 0),
        methode: nonConfs.reduce((sum, nc) => sum + nc.methode, 0),
        maintenance: nonConfs.reduce((sum, nc) => sum + nc.maintenance, 0),
        qualite: nonConfs.reduce((sum, nc) => sum + nc.qualite, 0),
         environnement: nonConfs.reduce((sum, nc) => sum + nc.environnement, 0)
      };

      const response = {
        message: 'Calcul du pourcentage total des écarts',
        semaine,
        ligne,
        reference,
        totalEcart,
        totalQuantite,
        pourcentageTotal: `${pourcentageTotal}%`,
        pourcentageTotalNumber: pourcentageTotal,
        nombreJours: planifications.length,
        repartitionParCause,
        details
      };

      console.log('=== FIN getTotalEcartPourcentage ===');
      return response;

    } catch (error) {
      console.error('Erreur dans getTotalEcartPourcentage:', error);
      throw new InternalServerErrorException(
        `Erreur lors du calcul du pourcentage total: ${error.message}`
      );
    }
  }


   async getNonConformitesByDateAndLigne(filterDto: GetNonConfByDateDto) {
    const { date, ligne, semaine } = filterDto;
    
    console.log('=== DÉBUT getNonConformitesByDateAndLigne ===');
    console.log('Filtres reçus:', { date, ligne, semaine });

    try {
      // 1. Convertir la date en format jour (ex: "Lundi", "Mardi")
      const jour = this.convertDateToDay(date);
      console.log('Date convertie en jour:', jour);

      // 2. Construire la requête
      const queryBuilder = this.nonConfRepository
        .createQueryBuilder('nonConf')
        .leftJoinAndSelect('nonConf.planification', 'planification')
        .where('planification.ligne = :ligne', { ligne })
        .andWhere('planification.jour = :jour', { jour })
        .orderBy('nonConf.createdAt', 'DESC');

      // 3. Ajouter filtre semaine si fourni
      if (semaine && semaine.trim() !== '') {
        queryBuilder.andWhere('planification.semaine = :semaine', { semaine });
      }

      // 4. Exécuter la requête
      const nonConfs = await queryBuilder.getMany();
      console.log(`Nombre de non-conformités trouvées: ${nonConfs.length}`);

      // 5. Formater les résultats
      const formattedResults = nonConfs.map(nonConf => {
        const plan = nonConf.planification;
        const quantiteSource = this.getQuantitySource(plan);
        
        const ecartPourcentage = nonConf.ecartPourcentage > 0 
          ? nonConf.ecartPourcentage 
          : this.calculerEcartPourcentage(nonConf.total, quantiteSource);
        
        return {
          id: nonConf.id,
          semaine: plan.semaine,
          jour: plan.jour,
          ligne: plan.ligne,
          reference: plan.reference,
          of: plan.of,
          quantiteSource,
          decProduction: plan.decProduction,
          deltaProd: plan.deltaProd,
          pcsProd: `${plan.pcsProd}%`,
          total7M: nonConf.total,
          ecartPourcentage,
          details: {
            matierePremiere: nonConf.matierePremiere,
            referenceMatierePremiere: nonConf.referenceMatierePremiere,
            absence: nonConf.absence,
            rendement: nonConf.rendement,
            maintenance: nonConf.maintenance,
            qualite: nonConf.qualite,
            methode: nonConf.methode,
            environnement: nonConf.environnement,
            referenceQualite: nonConf.referenceQualite
          },
          commentaire: nonConf.commentaire,
          createdAt: nonConf.createdAt,
          updatedAt: nonConf.updatedAt
        };
      });

      // 6. Calculer les totaux (optionnel, selon vos besoins)
      const totals = {
        matierePremiere: formattedResults.reduce((sum, item) => sum + item.details.matierePremiere, 0),
        absence: formattedResults.reduce((sum, item) => sum + item.details.absence, 0),
        rendement: formattedResults.reduce((sum, item) => sum + item.details.rendement, 0),
        maintenance: formattedResults.reduce((sum, item) => sum + item.details.maintenance, 0),
        methode: formattedResults.reduce((sum, item) => sum + item.details.methode, 0),
        qualite: formattedResults.reduce((sum, item) => sum + item.details.qualite, 0),
        environnement: formattedResults.reduce((sum, item) => sum + item.details.environnement, 0),
        total7M: formattedResults.reduce((sum, item) => sum + item.total7M, 0),
        moyenneEcartPourcentage: formattedResults.length > 0 
          ? Math.round((formattedResults.reduce((sum, item) => sum + item.ecartPourcentage, 0) / formattedResults.length) * 10) / 10
          : 0
      };

      console.log('=== FIN getNonConformitesByDateAndLigne - Succès ===');

      return {
        message: 'Non-conformités récupérées avec succès',
        filters: {
          date,
          jour,
          ligne,
          semaine: semaine || 'Toutes semaines'
        },
        total: formattedResults.length,
        totals,
        rapports: formattedResults
      };

    } catch (error) {
      console.error('=== ERREUR dans getNonConformitesByDateAndLigne ===');
      console.error('Erreur:', error.message);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Erreur lors de la récupération des non-conformités: ${error.message}`
      );
    }
  }

   private convertDateToDay(dateString: string): string {
    try {
      const date = new Date(dateString);
      
      // Vérifier si la date est valide
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Format de date invalide. Utilisez YYYY-MM-DD');
      }
      
      const joursSemaine = [
        'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 
        'Jeudi', 'Vendredi', 'Samedi'
      ];
      
      const jourIndex = date.getDay();
      return joursSemaine[jourIndex];
      
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erreur de conversion de date. Format attendu: YYYY-MM-DD');
    }
  }


}

function In(matriculesArray: number[]): number | import("typeorm").FindOperator<number> | undefined {
  throw new Error('Function not implemented.');
}
