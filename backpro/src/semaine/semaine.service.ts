// src/semaine/semaine.service.ts
import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Semaine } from './entities/semaine.entity';
import { Planification } from './entities/planification.entity';
import { CreateSemaineDto } from './dto/create-semaine.dto';
import { CreatePlanificationDto } from './dto/create-planification.dto';
import { UpdatePlanificationByCriteriaDto } from './dto/update-planification-by-criteria.dto';
import { GetPlanificationsViewDto } from './dto/get-planifications-view.dto';
import { UpdateProductionPlanificationDto } from './dto/update-production-planification.dto';
import { Admin } from '../admin/entities/admin.entity';
import { Product } from '../product/entities/product.entity';
import { TempsSec } from '../temps-sec/entities/temps-sec.entity';
import { NonConfService } from 'src/non-conf/non-conf.service';
import { Inject, forwardRef } from '@nestjs/common';
import { UpdateMagasinPlanificationDto } from './dto/update-magasin-planification.dto';

@Injectable()
export class SemaineService {
  constructor(
    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,
    @InjectRepository(Planification)
    private planificationRepository: Repository<Planification>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(TempsSec)
    private tempsSecRepository: Repository<TempsSec>,
     @Inject(forwardRef(() => NonConfService)) // ✅ AJOUTÉ - Injection du NonConfService
    private nonConfService: NonConfService,
  ) {}

  // ==================== MÉTHODE UTILITAIRE : GET QUANTITY SOURCE ====================
  private getQuantitySource(planification: Planification): number {
    // Si qteModifiee existe et > 0, l'utiliser, sinon utiliser qtePlanifiee
    return planification.qteModifiee > 0 ? planification.qteModifiee : planification.qtePlanifiee;
  }

  // ==================== CRÉATION SEMAINE AVEC PLANIFICATIONS VIDES ====================
  async createSemaine(createSemaineDto: CreateSemaineDto, admin: Admin) {
    const existingSemaine = await this.semaineRepository.findOne({
      where: { nom: createSemaineDto.nom }
    });

    if (existingSemaine) {
      throw new ConflictException(`La semaine "${createSemaineDto.nom}" existe déjà`);
    }

    try {
      // 1. Créer la semaine
      const semaine = new Semaine();
      semaine.nom = createSemaineDto.nom;
      semaine.dateDebut = new Date(createSemaineDto.dateDebut);
      semaine.dateFin = new Date(createSemaineDto.dateFin);
      semaine.creePar = admin;

      const savedSemaine = await this.semaineRepository.save(semaine);

      // 2. Récupérer TOUTES les combinaisons Ligne×Référence
      const products = await this.productRepository.find({
        select: ['ligne', 'reference'],
      });

      // 3. Créer des planifications vides pour chaque combinaison × jour
      const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const planificationsToCreate: Planification[] = [];
      let totalPlanificationsCrees = 0;

      for (const product of products) {
        for (const jour of jours) {
          const planification = new Planification();
          planification.semaine = savedSemaine.nom;
          planification.jour = jour;
          planification.ligne = product.ligne;
          planification.reference = product.reference;
          planification.of = '';
          planification.qtePlanifiee = 0;
          planification.qteModifiee = 0;
          planification.emballage = '200';
          planification.nbOperateurs = 0;
          planification.nbHeuresPlanifiees = 0;
          planification.decProduction = 0;
          planification.decMagasin = 0;
          planification.deltaProd = 0;
          planification.pcsProd = 0;
          planification.semaineEntity = savedSemaine;

          planificationsToCreate.push(planification);
          totalPlanificationsCrees++;
        }
      }

      // 4. Sauvegarder toutes les planifications
      if (planificationsToCreate.length > 0) {
        await this.planificationRepository.save(planificationsToCreate);
      }

      return {
        message: `Semaine "${createSemaineDto.nom}" créée avec succès`,
        semaine: {
          id: savedSemaine.id,
          nom: savedSemaine.nom,
          dateDebut: savedSemaine.dateDebut,
          dateFin: savedSemaine.dateFin,
          totalPlanifications: totalPlanificationsCrees,
          totalCombinaisons: products.length
        }
      };
    } catch (error) {
      console.error('Erreur création semaine:', error);
      throw new InternalServerErrorException('Erreur lors de la création de la semaine');
    }
  }

  // ==================== CRÉATION PLANIFICATION ====================
  async createPlanification(createPlanificationDto: CreatePlanificationDto) {
    const { semaine, jour, ligne, reference, qtePlanifiee = 0, qteModifiee = 0 } = createPlanificationDto;

    // Valider le jour
    const joursValides = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    if (!joursValides.includes(jour)) {
      throw new BadRequestException('Jour invalide');
    }

    // Vérifier si existe déjà
    const existingPlanification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference }
    });

    if (existingPlanification) {
      throw new ConflictException('Une planification existe déjà pour cette combinaison');
    }

    // Trouver la semaine
    const semaineEntity = await this.semaineRepository.findOne({
      where: { nom: semaine }
    });

    if (!semaineEntity) {
      throw new NotFoundException(`Semaine "${semaine}" non trouvée`);
    }

    // Rechercher le temps par seconde
    const tempsSec = await this.tempsSecRepository.findOne({
      where: { ligne, reference }
    });

    if (!tempsSec) {
      throw new NotFoundException(`Temps par seconde non trouvé pour "${ligne}" - "${reference}"`);
    }

    // DÉTERMINER LA QUANTITÉ SOURCE POUR LES CALCULS
    const quantiteSource = qteModifiee > 0 ? qteModifiee : qtePlanifiee;

    // CALCULER LES CHAMPS BASÉS SUR LA QUANTITÉ SOURCE
    const { nbHeuresPlanifiees, nbOperateurs } = this.calculateAutoPlanificationFields(
      quantiteSource, 
      tempsSec.seconde
    );

    const { deltaProd, pcsProd } = this.calculateAutoProductionFields(quantiteSource, 0);

    // Créer la planification
    const planification = new Planification();
    planification.semaine = semaine;
    planification.jour = jour;
    planification.ligne = ligne;
    planification.reference = reference;
    planification.of = createPlanificationDto.of || '';
    planification.qtePlanifiee = qtePlanifiee;
    planification.qteModifiee = qteModifiee;
    planification.emballage = createPlanificationDto.emballage || '200';
    planification.nbOperateurs = nbOperateurs;
    planification.nbHeuresPlanifiees = nbHeuresPlanifiees;
    planification.decProduction = 0;
    planification.decMagasin = 0;
    planification.deltaProd = deltaProd;
    planification.pcsProd = pcsProd;
    planification.semaineEntity = semaineEntity;

    const savedPlanification = await this.planificationRepository.save(planification);

    return {
      message: 'Planification créée avec succès',
      planification: {
        id: savedPlanification.id,
        semaine: savedPlanification.semaine,
        jour: savedPlanification.jour,
        ligne: savedPlanification.ligne,
        reference: savedPlanification.reference,
        of: savedPlanification.of,
        qtePlanifiee: savedPlanification.qtePlanifiee,
        qteModifiee: savedPlanification.qteModifiee,
        emballage: savedPlanification.emballage,
        nbOperateurs: savedPlanification.nbOperateurs,
        nbHeuresPlanifiees: savedPlanification.nbHeuresPlanifiees,
        decProduction: savedPlanification.decProduction,
        decMagasin: savedPlanification.decMagasin,
        deltaProd: savedPlanification.deltaProd,
        pcsProd: `${savedPlanification.pcsProd}%`
      }
    };
  }

  // ==================== MISE À JOUR PLANIFICATION (Admin) ====================
  async updatePlanificationByCriteria(updatePlanificationDto: UpdatePlanificationByCriteriaDto) {
    const { semaine, jour, ligne, reference, qtePlanifiee, qteModifiee, decProduction } = updatePlanificationDto;

    const planification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference }
    });

    if (!planification) {
      throw new NotFoundException('Planification non trouvée');
    }

    const ancienneQuantiteSource = this.getQuantitySource(planification);

    // Mettre à jour les champs de base
    if (updatePlanificationDto.of !== undefined) planification.of = updatePlanificationDto.of;
    if (qtePlanifiee !== undefined) planification.qtePlanifiee = qtePlanifiee;
    if (qteModifiee !== undefined) planification.qteModifiee = qteModifiee;
    if (decProduction !== undefined) planification.decProduction = decProduction;
    if (updatePlanificationDto.decMagasin !== undefined) planification.decMagasin = updatePlanificationDto.decMagasin;
    if (updatePlanificationDto.emballage !== undefined) planification.emballage = updatePlanificationDto.emballage;

    const nouvelleQuantiteSource = this.getQuantitySource(planification);

    // SI LA QUANTITÉ SOURCE CHANGE, RECALCULER LES TEMPS
    if (nouvelleQuantiteSource !== ancienneQuantiteSource) {
      const tempsSec = await this.tempsSecRepository.findOne({
        where: { ligne, reference }
      });

      if (tempsSec) {
        const { nbHeuresPlanifiees, nbOperateurs } = this.calculateAutoPlanificationFields(
          nouvelleQuantiteSource, 
          tempsSec.seconde
        );
        planification.nbOperateurs = nbOperateurs;
        planification.nbHeuresPlanifiees = nbHeuresPlanifiees;
      }
    }

    // RECALCULER LES CHAMPS DE PRODUCTION
    const { deltaProd, pcsProd } = this.calculateAutoProductionFields(
      nouvelleQuantiteSource,
      planification.decProduction
    );
    planification.deltaProd = deltaProd;
    planification.pcsProd = pcsProd;

    planification.updatedAt = new Date();
    const updatedPlanification = await this.planificationRepository.save(planification);

    // ✅ NOUVEAU : Nettoyer automatiquement la non-conformité si deltaProd = 0
    if (deltaProd === 0) {
      await this.nonConfService.cleanNonConformiteIfNeeded(updatedPlanification.id);
    }

    return {
      message: 'Planification mise à jour',
      planification: {
        id: updatedPlanification.id,
        semaine: updatedPlanification.semaine,
        jour: updatedPlanification.jour,
        ligne: updatedPlanification.ligne,
        reference: updatedPlanification.reference,
        of: updatedPlanification.of,
        qtePlanifiee: updatedPlanification.qtePlanifiee,
        qteModifiee: updatedPlanification.qteModifiee,
        emballage: updatedPlanification.emballage,
        nbOperateurs: updatedPlanification.nbOperateurs,
        nbHeuresPlanifiees: updatedPlanification.nbHeuresPlanifiees,
        decProduction: updatedPlanification.decProduction,
        decMagasin: updatedPlanification.decMagasin,
        deltaProd: updatedPlanification.deltaProd,
        pcsProd: `${updatedPlanification.pcsProd}%`,
        updatedAt: updatedPlanification.updatedAt
      }
    };
  }

  // ==================== DÉCLARATION PRODUCTION (User) ====================
  async updateProductionPlanification(updateProductionDto: UpdateProductionPlanificationDto) {
    const { semaine, jour, ligne, reference, qteModifiee, decProduction } = updateProductionDto;

    const planification = await this.planificationRepository.findOne({
      where: { semaine, jour, ligne, reference }
    });

    if (!planification) {
      throw new NotFoundException('Planification non trouvée');
    }

    let quantiteSource = this.getQuantitySource(planification);
    
    if (qteModifiee !== undefined) {
      planification.qteModifiee = qteModifiee;
      quantiteSource = this.getQuantitySource(planification);
      
      const tempsSec = await this.tempsSecRepository.findOne({
        where: { ligne, reference }
      });

      if (tempsSec) {
        const { nbHeuresPlanifiees, nbOperateurs } = this.calculateAutoPlanificationFields(
          quantiteSource, 
          tempsSec.seconde
        );
        planification.nbOperateurs = nbOperateurs;
        planification.nbHeuresPlanifiees = nbHeuresPlanifiees;
      }
    }

    if (decProduction !== undefined) {
      planification.decProduction = decProduction;
    }

    const { deltaProd, pcsProd } = this.calculateAutoProductionFields(
      quantiteSource,
      planification.decProduction
    );
    planification.deltaProd = deltaProd;
    planification.pcsProd = pcsProd;

    planification.updatedAt = new Date();
    const updatedPlanification = await this.planificationRepository.save(planification);

    // ✅ NOUVEAU : Nettoyer automatiquement la non-conformité si deltaProd = 0
    if (deltaProd === 0) {
      await this.nonConfService.cleanNonConformiteIfNeeded(updatedPlanification.id);
    }

    return {
      message: 'Production mise à jour',
      planification: {
        id: updatedPlanification.id,
        semaine: updatedPlanification.semaine,
        jour: updatedPlanification.jour,
        ligne: updatedPlanification.ligne,
        reference: updatedPlanification.reference,
        of: updatedPlanification.of,
        qtePlanifiee: updatedPlanification.qtePlanifiee,
        qteModifiee: updatedPlanification.qteModifiee,
        decProduction: updatedPlanification.decProduction,
        decMagasin: updatedPlanification.decMagasin,
        deltaProd: updatedPlanification.deltaProd,
        pcsProd: `${updatedPlanification.pcsProd}%`,
        updatedAt: updatedPlanification.updatedAt
      }
    };
  }

  // ==================== ENDPOINT : RÉSUMÉ PAR LIGNE (FILTRÉ) ====================
  async getPlanificationsVuProd(semaine: string, ligne: string) {
    console.log(`=== RÉSUMÉ POUR ${ligne} - ${semaine} ===`);

    // Vérifier si la semaine existe
    const semaineEntity = await this.semaineRepository.findOne({
      where: { nom: semaine }
    });

    if (!semaineEntity) {
      throw new NotFoundException(`Semaine "${semaine}" non trouvée`);
    }

    // Récupérer TOUTES les planifications (pour les totaux)
    const toutesLesPlanifications = await this.planificationRepository.find({
      where: { 
        semaine: semaine,
        ligne: ligne
      },
      order: { jour: 'ASC', reference: 'ASC' }
    });

    if (toutesLesPlanifications.length === 0) {
      return {
        message: `Aucune planification trouvée pour la ligne ${ligne} dans la semaine ${semaine}`,
        semaine: semaine,
        ligne: ligne,
        stats: {
          totalPlanifications: 0,
          planificationsAffichees: 0,
          totalQtePlanifiee: 0,
          totalQteModifiee: 0,
          totalDecProduction: 0,
          totalDecMagasin: 0,
          deltaProdTotal: 0,
          pcsProdTotal: 0,
          detailsParJour: {}
        }
      };
    }

    // FILTRER les planifications à afficher (qtePlanifiee > 0)
    const planificationsAffichees = toutesLesPlanifications.filter(plan => plan.qtePlanifiee > 0);

    // CALCULER LES TOTAUX (sur TOUTES les planifications)
    let totalQtePlanifiee = 0;
    let totalQteModifiee = 0;
    let totalQteSource = 0;
    let totalDecProduction = 0;
    let totalDecMagasin = 0;
    let totalDeltaProd = 0;

    const detailsParJour: any = {};

    // Initialiser les jours
    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    jours.forEach(jour => {
      detailsParJour[jour] = {
        qtePlanifiee: 0,
        qteModifiee: 0,
        qteSource: 0,
        decProduction: 0,
        deltaProd: 0,
        pcsProd: 0,
        references: []
      };
    });

    // Parcourir TOUTES les planifications pour les totaux
    for (const plan of toutesLesPlanifications) {
      const quantiteSource = this.getQuantitySource(plan);
      
      // Totaux généraux
      totalQtePlanifiee += plan.qtePlanifiee;
      totalQteModifiee += plan.qteModifiee;
      totalQteSource += quantiteSource;
      totalDecProduction += plan.decProduction;
      totalDecMagasin += plan.decMagasin;
      totalDeltaProd += plan.deltaProd;

      // Détails par jour (TOUS)
      if (detailsParJour[plan.jour]) {
        detailsParJour[plan.jour].qtePlanifiee += plan.qtePlanifiee;
        detailsParJour[plan.jour].qteModifiee += plan.qteModifiee;
        detailsParJour[plan.jour].qteSource += quantiteSource;
        detailsParJour[plan.jour].decProduction += plan.decProduction;
        detailsParJour[plan.jour].deltaProd += plan.deltaProd;
        
        // Ajouter la référence au jour SEULEMENT SI qtePlanifiee > 0
        if (plan.qtePlanifiee > 0) {
          detailsParJour[plan.jour].references.push({
            reference: plan.reference,
            of: plan.of,
            qtePlanifiee: plan.qtePlanifiee,
            qteModifiee: plan.qteModifiee,
            quantiteSource: quantiteSource,
            decProduction: plan.decProduction,
            deltaProd: plan.deltaProd,
            pcsProd: `${plan.pcsProd}%`,
            nbOperateurs: plan.nbOperateurs
          });
        }
      }
    }

    // Calculer le %PCs total
    const pcsProdTotal = totalQteSource > 0 ? (totalDecProduction / totalQteSource) * 100 : 0;

    // Calculer le delta total
    const deltaProdTotal = totalDecProduction - totalQteSource;

    // Calculer %PCs par jour
    jours.forEach(jour => {
      const jourData = detailsParJour[jour];
      jourData.pcsProd = jourData.qteSource > 0 ? (jourData.decProduction / jourData.qteSource) * 100 : 0;
    });

    return {
      message: `Résumé pour la ligne ${ligne} - Semaine ${semaine}`,
      semaine: {
        id: semaineEntity.id,
        nom: semaineEntity.nom,
        dateDebut: semaineEntity.dateDebut,
        dateFin: semaineEntity.dateFin
      },
      ligne: ligne,
      stats: {
        totalPlanifications: toutesLesPlanifications.length, // TOUTES les planifications
        planificationsAffichees: planificationsAffichees.length, // Celles avec qtePlanifiee > 0
        totalQtePlanifiee: totalQtePlanifiee,
        totalQteModifiee: totalQteModifiee,
        totalQteSource: totalQteSource,
        totalDecProduction: totalDecProduction,
        totalDecMagasin: totalDecMagasin,
        deltaProdTotal: deltaProdTotal,
        pcsProdTotal: Math.round(pcsProdTotal * 100) / 100,
        detailsParJour: detailsParJour
      },
      planifications: planificationsAffichees.map(plan => ({
        id: plan.id,
        jour: plan.jour,
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: this.getQuantitySource(plan),
        decProduction: plan.decProduction,
        decMagasin: plan.decMagasin,
        deltaProd: plan.deltaProd,
        pcsProd: `${plan.pcsProd}%`,
        nbOperateurs: plan.nbOperateurs,
        nbHeuresPlanifiees: plan.nbHeuresPlanifiees,
        emballage: plan.emballage
      }))
    };
  }

  // ==================== VUE UTILISATEUR (FILTRÉ) ====================
  async getPlanificationsView(getPlanificationsViewDto: GetPlanificationsViewDto) {
    const { semaine } = getPlanificationsViewDto;

    const semaineEntity = await this.semaineRepository.findOne({
      where: { nom: semaine }
    });

    if (!semaineEntity) {
      throw new NotFoundException(`Semaine "${semaine}" non trouvée`);
    }

    // Récupérer TOUTES les planifications
    const toutesLesPlanifications = await this.planificationRepository.find({
      where: { semaine },
      order: { ligne: 'ASC', jour: 'ASC' }
    });

    // Filtrer celles avec qtePlanifiee > 0
    const planificationsAffichees = toutesLesPlanifications.filter(plan => plan.qtePlanifiee > 0);

    return {
      message: `Planifications de la semaine "${semaine}"`,
      semaine: {
        id: semaineEntity.id,
        nom: semaineEntity.nom,
        dateDebut: semaineEntity.dateDebut,
        dateFin: semaineEntity.dateFin
      },
      totalPlanifications: toutesLesPlanifications.length, // TOUTES
      planificationsAffichees: planificationsAffichees.length, // FILTRÉES
      planifications: planificationsAffichees.map(plan => ({
        id: plan.id,
        semaine: plan.semaine,
        jour: plan.jour,
        ligne: plan.ligne,
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: this.getQuantitySource(plan),
        emballage: plan.emballage,
        nbOperateurs: plan.nbOperateurs,
        nbHeuresPlanifiees: plan.nbHeuresPlanifiees,
        decProduction: plan.decProduction,
        decMagasin: plan.decMagasin,
        deltaProd: plan.deltaProd,
        pcsProd: `${plan.pcsProd}%`
      }))
    };
  }

  // ==================== MÉTHODES EXISTANTES (inchangées) ====================
  async getSemaines() {
    const semaines = await this.semaineRepository.find({
      relations: ['creePar'],
      order: { dateDebut: 'DESC' }
    });

    const semainesAvecStats = await Promise.all(
      semaines.map(async (semaine) => {
        const count = await this.planificationRepository.count({
          where: { semaine: semaine.nom }
        });
        
        return {
          id: semaine.id,
          nom: semaine.nom,
          dateDebut: semaine.dateDebut,
          dateFin: semaine.dateFin,
          creePar: semaine.creePar.nom,
          totalPlanifications: count,
          createdAt: semaine.createdAt
        };
      })
    );

    return { semaines: semainesAvecStats };
  }

  async getAllPlanifications() {
    const planifications = await this.planificationRepository.find({
      relations: ['semaineEntity'],
      order: { semaine: 'DESC', ligne: 'ASC', jour: 'ASC' }
    });

    return {
      total: planifications.length,
      planifications: planifications.map(plan => ({
        id: plan.id,
        semaine: plan.semaine,
        jour: plan.jour,
        ligne: plan.ligne,
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: this.getQuantitySource(plan),
        emballage: plan.emballage,
        nbOperateurs: plan.nbOperateurs,
        nbHeuresPlanifiees: plan.nbHeuresPlanifiees,
        decProduction: plan.decProduction,
        decMagasin: plan.decMagasin,
        deltaProd: plan.deltaProd,
        pcsProd: `${plan.pcsProd}%`,
        semaineEntity: {
          id: plan.semaineEntity.id,
          dateDebut: plan.semaineEntity.dateDebut,
          dateFin: plan.semaineEntity.dateFin
        }
      }))
    };
  }

  async getPlanificationsBySemaine(semaineNom: string) {
    const semaine = await this.semaineRepository.findOne({
      where: { nom: semaineNom }
    });

    if (!semaine) {
      throw new NotFoundException(`Semaine "${semaineNom}" non trouvée`);
    }

    const planifications = await this.planificationRepository.find({
      where: { semaine: semaineNom },
      order: { ligne: 'ASC', jour: 'ASC', reference: 'ASC' }
    });

    return {
      semaine: {
        id: semaine.id,
        nom: semaine.nom,
        dateDebut: semaine.dateDebut,
        dateFin: semaine.dateFin
      },
      totalPlanifications: planifications.length,
      planifications: planifications.map(plan => ({
        id: plan.id,
        semaine: plan.semaine,
        jour: plan.jour,
        ligne: plan.ligne,
        reference: plan.reference,
        of: plan.of,
        qtePlanifiee: plan.qtePlanifiee,
        qteModifiee: plan.qteModifiee,
        quantiteSource: this.getQuantitySource(plan),
        emballage: plan.emballage,
        nbOperateurs: plan.nbOperateurs,
        nbHeuresPlanifiees: plan.nbHeuresPlanifiees,
        decProduction: plan.decProduction,
        decMagasin: plan.decMagasin,
        deltaProd: plan.deltaProd,
        pcsProd: `${plan.pcsProd}%`
      }))
    };
  }

  // ==================== SUPPRESSION ====================
  async deleteSemaine(id: number) {
    const semaine = await this.semaineRepository.findOne({
      where: { id },
      relations: ['planifications']
    });

    if (!semaine) {
      throw new NotFoundException('Semaine non trouvée');
    }

    if (semaine.planifications && semaine.planifications.length > 0) {
      await this.planificationRepository.remove(semaine.planifications);
    }

    await this.semaineRepository.remove(semaine);

    return { message: `Semaine "${semaine.nom}" supprimée avec succès` };
  }

  async deletePlanification(id: number) {
    const planification = await this.planificationRepository.findOne({
      where: { id }
    });

    if (!planification) {
      throw new NotFoundException('Planification non trouvée');
    }

    await this.planificationRepository.remove(planification);

    return { message: 'Planification supprimée', id };
  }

  // ==================== MÉTHODES PRIVÉES DE CALCUL ====================
  private calculateAutoPlanificationFields(quantite: number, tempsSec: number) {
    if (!quantite || quantite <= 0 || !tempsSec || tempsSec <= 0) {
      return { nbHeuresPlanifiees: 0, nbOperateurs: 0 };
    }

    const nbHeuresPlanifieesBrut = (quantite * tempsSec) / 3600;
    const nbHeuresPlanifiees = Math.floor(nbHeuresPlanifieesBrut * 100) / 100;
    
    const nbOperateursBrut = nbHeuresPlanifiees / 8;
    const nbOperateurs = Math.floor(nbOperateursBrut * 100) / 100;
    
    return { nbHeuresPlanifiees, nbOperateurs };
  }

  private calculateAutoProductionFields(quantiteSource: number, decProduction: number) {
    const deltaProd = decProduction - quantiteSource;
    const pcsProd = quantiteSource > 0 ? (decProduction / quantiteSource) * 100 : 0;
    
    return {
      deltaProd: deltaProd,
      pcsProd: Math.round(pcsProd * 100) / 100
    };
  }
  // Dans semaine.service.ts, ajouter cette méthode
async updateMagasinPlanification(updateMagasinDto: UpdateMagasinPlanificationDto) {
  const { semaine, jour, ligne, reference, decMagasin } = updateMagasinDto;

  const planification = await this.planificationRepository.findOne({
    where: { semaine, jour, ligne, reference }
  });

  if (!planification) {
    throw new NotFoundException('Planification non trouvée');
  }

  // Mettre à jour la déclaration magasin
  planification.decMagasin = decMagasin;
  
  // Calculer le delta magasin (si vous voulez ajouter ce champ)
  // planification.deltaMagasin = decMagasin - quantiteSource;
  
  planification.updatedAt = new Date();
  const updatedPlanification = await this.planificationRepository.save(planification);

  return {
    message: 'Déclaration magasin mise à jour',
    planification: {
      id: updatedPlanification.id,
      semaine: updatedPlanification.semaine,
      jour: updatedPlanification.jour,
      ligne: updatedPlanification.ligne,
      reference: updatedPlanification.reference,
      decMagasin: updatedPlanification.decMagasin,
      updatedAt: updatedPlanification.updatedAt
    }
  };
}
}