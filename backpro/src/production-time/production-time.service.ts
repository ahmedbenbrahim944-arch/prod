// src/production-time/production-time.service.ts
import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException,
  InternalServerErrorException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { ProductionSession } from './entities/production-session.entity';
import { PauseSession } from './entities/pause-session.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { TempsSec } from '../temps-sec/entities/temps-sec.entity';
import { MatierePremier } from '../matiere-premier/entities/matiere-premier.entity';
import { Phase } from '../phase/entities/phase.entity';
import { StartProductionDto } from './dto/start-production.dto';
import { PauseProductionDto } from './dto/pause-production.dto';
import { ResumeProductionDto } from './dto/resume-production.dto';
import { EndProductionDto } from './dto/end-production.dto';
import { UpdatePauseDto } from './dto/update-pause.dto';
import { Between,MoreThanOrEqual } from 'typeorm';
import { Planification ,  } from '../semaine/entities/planification.entity'; 
import { Not } from 'typeorm';
import { Semaine } from '../semaine/entities/semaine.entity';



@Injectable()
export class ProductionTimeService {
  constructor(
    @InjectRepository(ProductionSession)
    private productionSessionRepo: Repository<ProductionSession>,
    
    @InjectRepository(PauseSession)
    private pauseSessionRepo: Repository<PauseSession>,
    
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    
    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(TempsSec)
    private tempsSecRepo: Repository<TempsSec>,

    @InjectRepository(MatierePremier)
    private matierePremierRepo: Repository<MatierePremier>,

    @InjectRepository(Phase)
    private phaseRepo: Repository<Phase>,
    @InjectRepository(Planification)
    private planificationRepo: Repository<Planification>,
    @InjectRepository(Semaine)
    private semaineRepo: Repository<Semaine>
  ) {}

  /**
   * 🆕 Obtenir les références disponibles pour une ligne selon la catégorie M
   */
  async getAvailableReferencesForPause(ligne: string, mCategory: string) {
    try {
      switch (mCategory) {
        case 'M1': // Matière Première
          const matieres = await this.matierePremierRepo.find({
            where: { ligne },
            select: ['refMatierePremier']
          });
          return {
            mCategory,
            references: matieres.map(m => m.refMatierePremier),
            type: 'matierePremiere'
          };

        case 'M4': // Maintenance - Phases
          const phases = await this.phaseRepo.find({
            where: { ligne },
            select: ['phase']
          });
          return {
            mCategory,
            references: phases.map(p => p.phase),
            type: 'phases'
          };

        case 'M5': // Qualité - Produits
          const products = await this.productRepo.find({
            where: { ligne },
            select: ['reference']
          });
          return {
            mCategory,
            references: products.map(p => p.reference),
            type: 'products'
          };

        default:
          return {
            mCategory,
            references: [],
            type: 'none',
            message: 'Aucune référence requise pour cette catégorie'
          };
      }
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de la récupération des références');
    }
  }

  /**
   * 🆕 Calculer automatiquement la quantité produite
   */
  private async calculateQuantityProduced(ligne: string, reference: string, totalProductionSeconds: number): Promise<number> {
    try {
      // Chercher le temps par pièce dans la table temps_sec
      const tempsSec = await this.tempsSecRepo.findOne({
        where: { ligne, reference }
      });

      if (!tempsSec || tempsSec.seconde <= 0) {
        console.warn(`Aucun temps défini pour ligne: ${ligne}, reference: ${reference}`);
        return 0;
      }

      // Calcul: quantité = temps total de production / temps par pièce
      const quantity = Math.floor(totalProductionSeconds / tempsSec.seconde);
      
      return quantity;
    } catch (error) {
      console.error('Erreur lors du calcul de la quantité:', error);
      return 0;
    }
  }

  /**
   * Démarrer une nouvelle session de production
   */
  async startProduction(startDto: StartProductionDto, user: User) {
  try {
    // ✅ MODIFIÉ : Supprimer la vérification de conflit pour permettre plusieurs sessions
    // La ligne peut avoir plusieurs sessions actives si elles ont des planifications différentes
    
    // Option 1 : Supprimer complètement la vérification
    // Option 2 : Vérifier seulement si la même planification est déjà en cours (plus précis)

    // Créer nouvelle session
    const session = this.productionSessionRepo.create({
      ligne: startDto.ligne,
      ligneId: startDto.ligne,
      startedBy: user,
      userName: `${user.prenom} ${user.nom}`.trim(),
      productType: startDto.productType,
      notes: startDto.notes,
      status: 'active'
    });

    const savedSession = await this.productionSessionRepo.save(session);

    // Attacher les planifications sélectionnées au démarrage
    if (startDto.planificationIds && startDto.planificationIds.length > 0) {
      const planifications = await this.planificationRepo.findByIds(startDto.planificationIds);
      const validPlanifs = planifications.filter(p => p.ligne === startDto.ligne && p.of && p.of.trim() !== '');
      savedSession.planifications = validPlanifs;
      await this.productionSessionRepo.save(savedSession);
    }

    return {
      message: 'Production démarrée avec succès',
      session: {
        id: savedSession.id,
        ligne: savedSession.ligne,
        startTime: savedSession.startTime,
        status: savedSession.status,
        startedBy: {
          id: user.id,
          name: `${user.prenom} ${user.nom}`.trim()
        },
        planifications: (savedSession.planifications || []).map(p => ({
          id: p.id,
          reference: p.reference,
          of: p.of,
          jour: p.jour,
          semaine: p.semaine,
          qtePlanifiee: p.qtePlanifiee,
          qteModifiee: p.qteModifiee,
        }))
      }
    };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ConflictException) {
      throw error;
    }
    throw new InternalServerErrorException('Erreur lors du démarrage de la production');
  }
}

  /**
   * ✅ MODIFIÉ - Mettre en pause la production avec références M1/M4/M5
   */
 async pauseProduction(pauseDto: PauseProductionDto, user: User) {
  try {
    const session = await this.productionSessionRepo.findOne({
      where: { 
        id: pauseDto.sessionId,
        status: 'active'
      }
    });
 
    if (!session) {
      throw new NotFoundException('Session active non trouvée');
    }
 
    // Vérifier s'il y a déjà une pause non terminée
    const existingPause = await this.pauseSessionRepo.findOne({
      where: { 
        productionSession: { id: pauseDto.sessionId },
        endTime: IsNull()
      }
    });
 
    if (existingPause) {
      throw new ConflictException('Une pause est déjà en cours pour cette session');
    }
 
    // ✅ Validation des références métier selon la catégorie M
    if (pauseDto.mCategory === 'M1' && (!pauseDto.matierePremierRefs || pauseDto.matierePremierRefs.length === 0)) {
      throw new BadRequestException('Les références matières premières sont obligatoires pour M1');
    }
    if (pauseDto.mCategory === 'M4' && (!pauseDto.phasesEnPanne || pauseDto.phasesEnPanne.length === 0)) {
      throw new BadRequestException('Les phases en panne sont obligatoires pour M4');
    }
    if (pauseDto.mCategory === 'M5' && (!pauseDto.productRefs || pauseDto.productRefs.length === 0)) {
      throw new BadRequestException('Les références produits sont obligatoires pour M5');
    }
 
    // ✅ NOUVEAU : Validation et récupération des planifications sélectionnées
    let planifications: Planification[] = [];
    if (pauseDto.planificationIds && pauseDto.planificationIds.length > 0) {
      // Récupérer les planifications depuis la BDD
      planifications = await this.planificationRepo.findByIds(pauseDto.planificationIds);
 
      // Vérifier que toutes les planifications trouvées appartiennent bien à cette ligne
      const wrongLine = planifications.find(p => p.ligne !== session.ligne);
      if (wrongLine) {
        throw new BadRequestException(
          `La planification (ref: ${wrongLine.reference}) n'appartient pas à la ligne ${session.ligne}`
        );
      }
 
      // Vérifier que toutes ont bien un OF non vide (= planifiées)
      const notPlanned = planifications.find(p => !p.of || p.of.trim() === '');
      if (notPlanned) {
        throw new BadRequestException(
          `La référence "${notPlanned.reference}" n'a pas de planning (OF vide)`
        );
      }
 
      // Vérifier que le nombre trouvé correspond aux IDs demandés
      if (planifications.length !== pauseDto.planificationIds.length) {
        throw new BadRequestException('Une ou plusieurs planifications demandées sont introuvables');
      }
    }
 
    // Créer la pause
    const pause = new PauseSession();
    pause.productionSession = session;
    pause.mCategory = pauseDto.mCategory;
    pause.subCategory = pauseDto.subCategory || '';
    pause.reason = pauseDto.reason || '';
    pause.recordedBy = user;
    pause.userName = `${user.prenom} ${user.nom}`.trim();
 
    // ✅ Références métier selon catégorie
    pause.matierePremierRefs = pauseDto.mCategory === 'M1' ? pauseDto.matierePremierRefs || [] : [];
    pause.phasesEnPanne = pauseDto.mCategory === 'M4' ? pauseDto.phasesEnPanne || [] : [];
    pause.productRefs = pauseDto.mCategory === 'M5' ? pauseDto.productRefs || [] : [];
 
    // ✅ NOUVEAU : Attacher les planifications sélectionnées
    pause.planifications = planifications;
 
    await this.pauseSessionRepo.save(pause);
 
    // Mettre à jour le statut de la session
    session.status = 'paused';
    await this.productionSessionRepo.save(session);
 
    return {
      message: `Production mise en pause (${pauseDto.mCategory})`,
      pause: {
        id: pause.id,
        startTime: pause.startTime,
        mCategory: pause.mCategory,
        subCategory: pause.subCategory,
        matierePremierRefs: pause.matierePremierRefs,
        phasesEnPanne: pause.phasesEnPanne,
        productRefs: pause.productRefs,
        // ✅ NOUVEAU : Retourner les infos des planifications liées
        planifications: planifications.map(p => ({
          id: p.id,
          reference: p.reference,
          of: p.of,
          jour: p.jour,
          semaine: p.semaine
        }))
      },
      session: {
        id: session.id,
        ligne: session.ligne,
        status: session.status
      }
    };
  } catch (error) {
    if (
      error instanceof NotFoundException ||
      error instanceof ConflictException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }
    throw new InternalServerErrorException('Erreur lors de la mise en pause');
  }
}

  /**
   * Reprendre la production après une pause
   */
async resumeProduction(resumeDto: ResumeProductionDto, user: User) {
  try {
    const session = await this.productionSessionRepo.findOne({
      where: { 
        id: resumeDto.sessionId,
        status: 'paused'
      },
      relations: ['pauses']
    });

    if (!session) {
      throw new NotFoundException('Session en pause non trouvée');
    }

    // Trouver la dernière pause non terminée
    const lastPause = session.pauses?.find(p => !p.endTime);
    
    if (!lastPause) {
      throw new NotFoundException('Aucune pause active trouvée');
    }

    // Récupérer le temps par pièce
    const tempsSec = await this.tempsSecRepo.findOne({
      where: { ligne: session.ligne, reference: session.productType }
    });

    // Mettre à jour la pause
    lastPause.endTime = new Date();
    if (resumeDto.actionTaken !== undefined) {
      lastPause.actionTaken = resumeDto.actionTaken;
    }
    lastPause.isCompleted = true;
    
    // Calculer la durée en secondes
    const durationMs = lastPause.endTime.getTime() - lastPause.startTime.getTime();
    lastPause.durationSeconds = Math.floor(durationMs / 1000);

    // ✅ CALCULER LES PIÈCES PERDUES PENDANT LA PAUSE
    if (tempsSec && tempsSec.seconde > 0) {
      // Pour toutes les catégories M, on calcule les pièces perdues
      // car toute pause arrête la production
      lastPause.lostPieces = Math.floor(lastPause.durationSeconds / tempsSec.seconde);
    }

    await this.pauseSessionRepo.save(lastPause);

    // Mettre à jour la session
    session.status = 'active';
    session.totalPauseSeconds += lastPause.durationSeconds;

    await this.productionSessionRepo.save(session);

    return {
      message: 'Production reprise avec succès',
      pause: {
        id: lastPause.id,
        duration: this.formatDuration(lastPause.durationSeconds),
        mCategory: lastPause.mCategory,
        lostPieces: lastPause.lostPieces // ✅ Afficher les pièces perdues
      },
      session: {
        id: session.id,
        ligne: session.ligne,
        status: session.status
      }
    };
  } catch (error) {
    if (error instanceof NotFoundException) {
      throw error;
    }
    throw new InternalServerErrorException('Erreur lors de la reprise de la production');
  }
}

  /**
   * ✅ MODIFIÉ - Terminer la session avec calcul automatique de quantité
   */
  async endProduction(endDto: EndProductionDto, user: User) {
    try {
      const session = await this.productionSessionRepo.findOne({
        where: { 
          id: endDto.sessionId,
          status: In(['active', 'paused'])
        },
        relations: ['pauses']
      });

      if (!session) {
        throw new NotFoundException('Session active non trouvée');
      }

      // Terminer toute pause en cours
      const activePause = session.pauses?.find(p => !p.endTime);
      if (activePause) {
        const now = new Date();
        activePause.endTime = now;
        activePause.durationSeconds = Math.floor((now.getTime() - activePause.startTime.getTime()) / 1000);
        activePause.isCompleted = true;
        await this.pauseSessionRepo.save(activePause);
        session.totalPauseSeconds += activePause.durationSeconds;
      }

      // Calculer le temps total de production
      const endTime = new Date();
      const totalDurationSeconds = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
      session.totalProductionSeconds = totalDurationSeconds - session.totalPauseSeconds;

      // ✅ CALCUL AUTOMATIQUE DE LA QUANTITÉ
      let calculatedQuantity = 0;
      
      if (session.productType) {
        // Si un productType est défini, calculer automatiquement
        calculatedQuantity = await this.calculateQuantityProduced(
          session.ligne, 
          session.productType, 
          session.totalProductionSeconds
        );
      }

      // Utiliser la quantité calculée ou celle fournie manuellement
      const finalQuantity = endDto.quantityProduced !== undefined 
        ? endDto.quantityProduced 
        : calculatedQuantity;

      // Mettre à jour la session
      session.endTime = endTime;
      session.status = 'completed';
      session.quantityProduced = finalQuantity;
      if (endDto.qualityStatus !== undefined) {
        session.qualityStatus = endDto.qualityStatus;
      }
      
      if (endDto.finalNotes) {
        session.notes = session.notes 
          ? `${session.notes}\n${endDto.finalNotes}` 
          : endDto.finalNotes;
      }

      await this.productionSessionRepo.save(session);

      return {
        message: 'Production terminée avec succès',
        session: {
          id: session.id,
          ligne: session.ligne,
          startTime: session.startTime,
          endTime: session.endTime,
          totalDuration: this.formatDuration(totalDurationSeconds),
          productionTime: this.formatDuration(session.totalProductionSeconds),
          pauseTime: this.formatDuration(session.totalPauseSeconds),
          efficiency: this.calculateEfficiency(session.totalProductionSeconds, totalDurationSeconds),
          quantityProduced: finalQuantity,
          quantityCalculated: calculatedQuantity, // Pour information
          qualityStatus: session.qualityStatus
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Erreur lors de la fin de la production');
    }
  }

  /**
   * ✅ MODIFIÉ - Mettre à jour une pause avec références
   */
  async updatePause(updateDto: UpdatePauseDto, user: User) {
    try {
      const pause = await this.pauseSessionRepo.findOne({
        where: { id: updateDto.pauseId },
        relations: ['productionSession']
      });

      if (!pause) {
        throw new NotFoundException('Pause non trouvée');
      }

      // Mettre à jour les champs standards
      if (updateDto.reason !== undefined) {
        pause.reason = updateDto.reason;
      }
      
      if (updateDto.actionTaken !== undefined) {
        pause.actionTaken = updateDto.actionTaken;
      }

      // ✅ Mettre à jour les références selon la catégorie
      if (pause.mCategory === 'M1' && updateDto.matierePremierRefs) {
        pause.matierePremierRefs = updateDto.matierePremierRefs;
      }

      if (pause.mCategory === 'M4' && updateDto.phasesEnPanne) {
        pause.phasesEnPanne = updateDto.phasesEnPanne;
      }

      if (pause.mCategory === 'M5' && updateDto.productRefs) {
        pause.productRefs = updateDto.productRefs;
      }

      await this.pauseSessionRepo.save(pause);

      return {
        message: 'Pause mise à jour avec succès',
        pause: {
          id: pause.id,
          mCategory: pause.mCategory,
          reason: pause.reason,
          actionTaken: pause.actionTaken,
          matierePremierRefs: pause.matierePremierRefs,
          phasesEnPanne: pause.phasesEnPanne,
          productRefs: pause.productRefs
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Erreur lors de la mise à jour de la pause');
    }
  }

  /**
   * Obtenir les statistiques d'une session
   */
  async getSessionStats(sessionId: number) {
    try {
      const session = await this.productionSessionRepo.findOne({
        where: { id: sessionId },
        relations: ['pauses', 'startedBy']
      });

      if (!session) {
        throw new NotFoundException('Session non trouvée');
      }

      const now = new Date();
      const totalDuration = session.endTime 
        ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
        : Math.floor((now.getTime() - session.startTime.getTime()) / 1000);

      // Calculer les statistiques des pauses par catégorie M
      const pausesByCategory = session.pauses?.reduce((acc, pause) => {
        if (!acc[pause.mCategory]) {
          acc[pause.mCategory] = {
            count: 0,
            totalDuration: 0,
            pauses: []
          };
        }
        acc[pause.mCategory].count++;
        acc[pause.mCategory].totalDuration += pause.durationSeconds;
        acc[pause.mCategory].pauses.push({
          id: pause.id,
  startTime: pause.startTime,
  endTime: pause.endTime,
  duration: this.formatDuration(pause.durationSeconds),
  durationSeconds: pause.durationSeconds,
  subCategory: pause.subCategory,
  reason: pause.reason,
  actionTaken: pause.actionTaken,
  lostPieces: pause.lostPieces,
  // Références métier
  matierePremierRefs: pause.matierePremierRefs,
  phasesEnPanne: pause.phasesEnPanne,
  productRefs: pause.productRefs,
  // ✅ NOUVEAU - Références planifiées liées à cette pause
  planifications: (pause.planifications || []).map(p => ({
    id: p.id,
    reference: p.reference,
    of: p.of,
    jour: p.jour,
    semaine: p.semaine,
  }))
});
        return acc;
      }, {});
      const totalLostPieces = session.pauses?.reduce((sum, p) => sum + (p.lostPieces || 0), 0) || 0;

      return {
        session: {
          id: session.id,
          ligne: session.ligne,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          productType: session.productType,
          quantityProduced: session.quantityProduced,
          qualityStatus: session.qualityStatus
        },
        timing: {
          totalDuration: this.formatDuration(totalDuration),
          productionTime: this.formatDuration(session.totalProductionSeconds),
          pauseTime: this.formatDuration(session.totalPauseSeconds),
          efficiency: this.calculateEfficiency(session.totalProductionSeconds, totalDuration)
        },
        production: {
  quantityProduced: session.quantityProduced,
  lostPieces: totalLostPieces,
  theoreticalQuantity: session.quantityProduced + totalLostPieces
},
        pauses: {
          total: session.pauses?.length || 0,
          byCategory: pausesByCategory
        },
        startedBy: session.userName || (session.startedBy ? `${session.startedBy.prenom} ${session.startedBy.nom}`.trim() : 'Inconnu')
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Erreur lors du calcul des statistiques');
    }
  }

  /**
   * Obtenir les statistiques d'une ligne
   */
  async getLineStats(ligne: string, startDate?: Date, endDate?: Date) {
    try {
      const query = this.productionSessionRepo.createQueryBuilder('session')
        .where('session.ligne = :ligne', { ligne })
        .andWhere('session.status = :status', { status: 'completed' })
        .leftJoinAndSelect('session.pauses', 'pauses');

      if (startDate) {
        query.andWhere('session.startTime >= :startDate', { startDate });
      }

      if (endDate) {
        query.andWhere('session.endTime <= :endDate', { endDate });
      }

      const sessions = await query.getMany();

      if (sessions.length === 0) {
        return {
          ligne,
          message: 'Aucune session complétée trouvée pour cette ligne',
          stats: null
        };
      }

      const totalSessions = sessions.length;

      // ✅ FIX: Protéger contre les valeurs null/undefined en base de données
      const totalProductionSeconds = sessions.reduce((sum, s) => sum + (s.totalProductionSeconds ?? 0), 0);
      const totalPauseSeconds = sessions.reduce((sum, s) => sum + (s.totalPauseSeconds ?? 0), 0);
      const totalQuantityProduced = sessions.reduce((sum, s) => sum + (s.quantityProduced ?? 0), 0);

      // Statistiques des pauses par catégorie M
      const pauseStats: Record<string, any> = {};
      sessions.forEach(session => {
        session.pauses?.forEach(pause => {
          // ✅ FIX: Ignorer les pauses sans catégorie
          if (!pause.mCategory) return;

          if (!pauseStats[pause.mCategory]) {
            pauseStats[pause.mCategory] = {
              count: 0,
              totalDuration: 0,
              averageDuration: 0,
              totalReferences: 0,
              references: []
            };
          }
          pauseStats[pause.mCategory].count++;
          // ✅ FIX: Protéger durationSeconds contre null
          pauseStats[pause.mCategory].totalDuration += (pause.durationSeconds ?? 0);

          // ✅ Collecter les références uniques (avec vérification tableau valide)
          if (Array.isArray(pause.matierePremierRefs) && pause.matierePremierRefs.length > 0) {
            pauseStats[pause.mCategory].references.push(...pause.matierePremierRefs);
            pauseStats[pause.mCategory].totalReferences += pause.matierePremierRefs.length;
          }
          if (Array.isArray(pause.phasesEnPanne) && pause.phasesEnPanne.length > 0) {
            pauseStats[pause.mCategory].references.push(...pause.phasesEnPanne);
            pauseStats[pause.mCategory].totalReferences += pause.phasesEnPanne.length;
          }
          if (Array.isArray(pause.productRefs) && pause.productRefs.length > 0) {
            pauseStats[pause.mCategory].references.push(...pause.productRefs);
            pauseStats[pause.mCategory].totalReferences += pause.productRefs.length;
          }
        });
      });

      // Calculer les moyennes et références uniques
      Object.keys(pauseStats).forEach(category => {
        const cat = pauseStats[category];
        // ✅ FIX: Éviter division par zéro
        cat.averageDuration = cat.count > 0
          ? Math.floor(cat.totalDuration / cat.count)
          : 0;
        cat.averageDurationFormatted = this.formatDuration(cat.averageDuration);
        cat.totalDurationFormatted = this.formatDuration(cat.totalDuration);
        cat.uniqueReferences = [...new Set(cat.references)];
        delete cat.references;
      });

      // ✅ FIX: Éviter division par zéro sur totalSessions (sécurité supplémentaire)
      const safeTotalSessions = totalSessions > 0 ? totalSessions : 1;

      return {
        ligne,
        period: {
          start: startDate,
          end: endDate
        },
        summary: {
          totalSessions,
          totalProductionTime: this.formatDuration(totalProductionSeconds),
          totalPauseTime: this.formatDuration(totalPauseSeconds),
          averageProductionTime: this.formatDuration(Math.floor(totalProductionSeconds / safeTotalSessions)),
          averagePauseTime: this.formatDuration(Math.floor(totalPauseSeconds / safeTotalSessions)),
          totalQuantityProduced,
          averageQuantityPerSession: Math.floor(totalQuantityProduced / safeTotalSessions),
          averageEfficiency: this.calculateEfficiency(
            totalProductionSeconds,
            totalProductionSeconds + totalPauseSeconds
          )
        },
        pauseStatsByCategory: pauseStats,
        recentSessions: sessions.slice(-5).map(s => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          productionTime: this.formatDuration(s.totalProductionSeconds ?? 0),
          pauseTime: this.formatDuration(s.totalPauseSeconds ?? 0),
          quantityProduced: s.quantityProduced ?? 0,
          // ✅ FIX: Protéger startTime et endTime contre null
          efficiency: this.calculateEfficiency(
            s.totalProductionSeconds ?? 0,
            (s.endTime && s.startTime)
              ? Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000)
              : 0
          )
        }))
      };
    } catch (error) {
      // ✅ FIX CRITIQUE: Logger l'erreur réelle pour faciliter le diagnostic
      console.error(`Erreur pour la ligne ${ligne}:`, error);
      throw new InternalServerErrorException('Erreur lors du calcul des statistiques de ligne');
    }
  }

  /**
   * Obtenir les sessions actives
   */
 async getActiveSessions() {
  try {
    const sessions = await this.productionSessionRepo.find({
      where: { 
        status: In(['active', 'paused'])
      },
      relations: ['pauses', 'startedBy', 'planifications'], // Ajouter planifications
      order: { startTime: 'DESC' }
    });

    return sessions.map(session => {
      const currentPause = session.pauses?.find(p => !p.endTime);
      
      return {
        id: session.id,
        ligne: session.ligne,
        startTime: session.startTime,
        status: session.status,
        productType: session.productType,
        // ✅ Ajouter les planifications pour que le frontend sache quelles références sont actives
        planifications: session.planifications || [],
        currentPause: currentPause ? {
          id: currentPause.id,
          mCategory: currentPause.mCategory,
          startTime: currentPause.startTime,
          duration: this.formatDuration(
            Math.floor((new Date().getTime() - currentPause.startTime.getTime()) / 1000)
          ),
          subCategory: currentPause.subCategory,
          matierePremierRefs: currentPause.matierePremierRefs,
          phasesEnPanne: currentPause.phasesEnPanne,
          productRefs: currentPause.productRefs,
          planifications: (currentPause.planifications || []).map(p => ({
            id: p.id,
            reference: p.reference,
            of: p.of,
            jour: p.jour,
            semaine: p.semaine,
          }))
        } : null,
        startedBy: session.userName || (session.startedBy ? `${session.startedBy.prenom} ${session.startedBy.nom}`.trim() : 'Inconnu'),
      };
    });
  } catch (error) {
    throw new InternalServerErrorException('Erreur lors de la récupération des sessions actives');
  }
}

  /**
   * Obtenir l'historique des sessions
   */
  async getSessionHistory(ligne?: string, page: number = 1, limit: number = 20) {
    try {
      const query = this.productionSessionRepo.createQueryBuilder('session')
        .where('session.status IN (:...statuses)', { statuses: ['completed', 'cancelled'] })
        .leftJoinAndSelect('session.startedBy', 'startedBy')
        .orderBy('session.startTime', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      if (ligne) {
        query.andWhere('session.ligne = :ligne', { ligne });
      }

      const [sessions, total] = await query.getManyAndCount();

      return {
        sessions: sessions.map(s => ({
          id: s.id,
          ligne: s.ligne,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.endTime ? this.formatDuration(
            Math.floor((s.endTime.getTime() - s.startTime.getTime()) / 1000)
          ) : 'En cours',
          productionTime: this.formatDuration(s.totalProductionSeconds),
          pauseTime: this.formatDuration(s.totalPauseSeconds),
          efficiency: this.calculateEfficiency(s.totalProductionSeconds,
            s.endTime ? Math.floor((s.endTime.getTime() - s.startTime.getTime()) / 1000) : 0),
          startedBy: s.userName || (s.startedBy ? `${s.startedBy.prenom} ${s.startedBy.nom}`.trim() : 'Inconnu'),
          status: s.status,
          quantityProduced: s.quantityProduced,
          qualityStatus: s.qualityStatus
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de la récupération de l\'historique');
    }
  }

  /**
   * Annuler une session
   */
  async cancelSession(sessionId: number, user: User) {
    try {
      const session = await this.productionSessionRepo.findOne({
        where: { id: sessionId },
        relations: ['pauses']
      });

      if (!session) {
        throw new NotFoundException('Session non trouvée');
      }

      if (session.status === 'completed') {
        throw new BadRequestException('Impossible d\'annuler une session terminée');
      }

      // Terminer toutes les pauses actives
      const activePauses = session.pauses?.filter(p => !p.endTime);
      if (activePauses?.length > 0) {
        const now = new Date();
        for (const pause of activePauses) {
          pause.endTime = now;
          pause.durationSeconds = Math.floor((now.getTime() - pause.startTime.getTime()) / 1000);
          pause.isCompleted = true;
          await this.pauseSessionRepo.save(pause);
        }
      }

      // Marquer la session comme annulée
      session.status = 'cancelled';
      session.endTime = new Date();
      session.notes = session.notes ? `${session.notes}\n[Annulée par ${user.prenom} ${user.nom} le ${new Date().toLocaleString()}]` 
                                   : `Annulée par ${user.prenom} ${user.nom} le ${new Date().toLocaleString()}`;
      
      await this.productionSessionRepo.save(session);

      return {
        message: 'Session annulée avec succès',
        sessionId: session.id,
        cancelledAt: session.endTime
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Erreur lors de l\'annulation de la session');
    }
  }

  /**
   * Vérifier l'état d'une ligne
   */
  async getLineStatus(ligne: string) {
    try {
      const activeSessions = await this.getActiveSessions();
      const lineSession = activeSessions.find(s => s.ligne === ligne);
      
      if (!lineSession) {
        return {
          ligne,
          status: 'inactive',
          message: 'La ligne n\'est pas en production'
        };
      }

      return {
        ligne,
        status: lineSession.status,
        sessionId: lineSession.id,
        startTime: lineSession.startTime,
        currentPause: lineSession.currentPause,
        productType: lineSession.productType,
        startedBy: lineSession.startedBy
      };
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de la vérification du statut de la ligne');
    }
  }

  /**
   * Obtenir les sessions d'un utilisateur
   */
  async getUserSessions(userId: number, page: number = 1, limit: number = 20) {
    try {
      const [sessions, total] = await this.productionSessionRepo.findAndCount({
        where: { startedBy: { id: userId } },
        relations: ['pauses'],
        order: { startTime: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        sessions: sessions.map(s => ({
          id: s.id,
          ligne: s.ligne,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          duration: s.endTime ? this.formatDuration(
            Math.floor((s.endTime.getTime() - s.startTime.getTime()) / 1000)
          ) : 'En cours',
          productionTime: this.formatDuration(s.totalProductionSeconds),
          pauseTime: this.formatDuration(s.totalPauseSeconds),
          efficiency: this.calculateEfficiency(s.totalProductionSeconds,
            s.endTime ? Math.floor((s.endTime.getTime() - s.startTime.getTime()) / 1000) : 0)
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de la récupération des sessions utilisateur');
    }
  }

  /**
   * Formater une durée en secondes en texte lisible
   */
  private formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  }

  /**
   * Calculer l'efficacité
   */
  private calculateEfficiency(productionSeconds: number, totalSeconds: number): string {
    if (totalSeconds <= 0) return '0%';
    const efficiency = (productionSeconds / totalSeconds) * 100;
    return `${efficiency.toFixed(2)}%`;
  }
  async getRealTimeProduction(sessionId: number): Promise<any> {
  try {
    const session = await this.productionSessionRepo.findOne({
      where: { id: sessionId },
      relations: ['pauses', 'pauses.planifications', 'planifications']
    });

    if (!session) {
      throw new NotFoundException('Session non trouvée');
    }

    const now = new Date();
    const totalElapsedSeconds = Math.floor((now.getTime() - session.startTime.getTime()) / 1000);
    
    // Calculer le temps de production effectif (temps total - temps des pauses terminées)
    let totalPauseSeconds = session.totalPauseSeconds;
    
    // Ajouter la pause en cours si elle existe
    const currentPause = session.pauses?.find(p => !p.endTime);
    if (currentPause) {
      const currentPauseDuration = Math.floor((now.getTime() - currentPause.startTime.getTime()) / 1000);
      totalPauseSeconds += currentPauseDuration;
    }

    const productionSeconds = totalElapsedSeconds - totalPauseSeconds;

    // Récupérer le temps par pièce depuis temps_sec
    const tempsSec = await this.tempsSecRepo.findOne({
      where: { ligne: session.ligne, reference: session.productType }
    });

    if (!tempsSec || tempsSec.seconde <= 0) {
      return {
        sessionId: session.id,
        ligne: session.ligne,
        productionSeconds,
        piecesProduites: 0,
        message: 'Temps par pièce non défini pour cette ligne'
      };
    }

    const piecesProduites = Math.floor(productionSeconds / tempsSec.seconde);
    
    // Calculer les pièces perdues pendant la pause en cours (si en pause)
    let piecesPerduesPauseEnCours = 0;
    if (currentPause) {
      const pauseDuration = Math.floor((now.getTime() - currentPause.startTime.getTime()) / 1000);
      piecesPerduesPauseEnCours = Math.floor(pauseDuration / tempsSec.seconde);
    }

    // Calculer le taux de production (pièces par heure)
    const tauxProduction = productionSeconds > 0 
      ? (piecesProduites / productionSeconds) * 3600 
      : 0;

    // ✅ FIX - IDs des refs liées à la pause en cours
    const pausedRefIds = new Set<number>(
      (currentPause?.planifications || []).map(p => p.id)
    );
    const currentPauseDurationSec = currentPause
      ? Math.floor((now.getTime() - currentPause.startTime.getTime()) / 1000)
      : 0;

    // ✅ Calculer pièces + temps par référence — indépendamment pour chaque ref
    const refsAvecCompteurs = await Promise.all(
      (session.planifications || []).map(async (p) => {
        const ts = await this.tempsSecRepo.findOne({ where: { ligne: session.ligne, reference: p.reference } });
        const secondesParPiece = ts?.seconde || 0;

        // Si cette ref est en pause → son temps de production = productionSeconds global
        // (la pause sur cette ref ne lui ajoute pas de temps de production)
        // Si cette ref n'est PAS en pause → elle continue pendant la pause des autres
        // donc son temps = productionSeconds + durée de la pause en cours
        const estEnPause = pausedRefIds.has(p.id);
        const tempsRefSec = estEnPause
          ? productionSeconds                          // arrêtée
          : productionSeconds + currentPauseDurationSec; // continue

        const piecesRef = secondesParPiece > 0 ? Math.floor(tempsRefSec / secondesParPiece) : 0;
        const piecesPerduesRef = estEnPause && secondesParPiece > 0
          ? Math.floor(currentPauseDurationSec / secondesParPiece)
          : 0;

        return {
          id: p.id,
          reference: p.reference,
          of: p.of,
          qtePlanifiee: p.qtePlanifiee,
          qteModifiee: p.qteModifiee,
          secondesParPiece,
          piecesProduites: piecesRef,
          piecesPerdues: piecesPerduesRef,
          estEnPause,
          tempsProduction: this.formatDuration(tempsRefSec),
          tempsProductionSeconds: tempsRefSec,
        };
      })
    );

    return {
      sessionId: session.id,
      ligne: session.ligne,
      productType: session.productType,
      status: session.status,
      tempsParPiece: tempsSec.seconde,
      tempsTotal: this.formatDuration(totalElapsedSeconds),
      tempsProduction: this.formatDuration(productionSeconds),
      tempsPause: this.formatDuration(totalPauseSeconds),
      piecesProduites,
      piecesProduitesPrevisionnelles: Math.floor(totalElapsedSeconds / tempsSec.seconde),
      tauxProduction: `${tauxProduction.toFixed(2)} pièces/heure`,
      pauseEnCours: currentPause ? {
        id: currentPause.id,
        mCategory: currentPause.mCategory,
        subCategory: currentPause.subCategory,
        reason: currentPause.reason,
        startTime: currentPause.startTime,
        duree: this.formatDuration(Math.floor((now.getTime() - currentPause.startTime.getTime()) / 1000)),
        duration: this.formatDuration(Math.floor((now.getTime() - currentPause.startTime.getTime()) / 1000)),
        piecesPerdues: piecesPerduesPauseEnCours,
        lostPieces: piecesPerduesPauseEnCours,
        matierePremierRefs: currentPause.matierePremierRefs ?? [],
        phasesEnPanne: currentPause.phasesEnPanne ?? [],
        productRefs: currentPause.productRefs ?? [],
        planifications: (currentPause.planifications || []).map((p: any) => ({
          id: p.id,
          reference: p.reference,
          of: p.of,
          jour: p.jour,
          semaine: p.semaine,
        }))
      } : null,
      // ✅ Compteurs par référence planifiée
      refsCompteurs: refsAvecCompteurs
    };
  } catch (error) {
    if (error instanceof NotFoundException) throw error;
    throw new InternalServerErrorException('Erreur lors du calcul en temps réel');
  }
}
async getAdminDashboardOverview(filters?: {
    startDate?: Date;
    endDate?: Date;
    ligne?: string;
    status?: string;
  }) {
    try {
      const now = new Date();
      
      // 1. Récupérer toutes les sessions actives
      const activeSessions = await this.getActiveSessions();
      
      // 2. Récupérer toutes les lignes disponibles
      const allLines = await this.productRepo
        .createQueryBuilder('product')
        .select('DISTINCT product.ligne', 'ligne')
        .getRawMany();

      const lignes = allLines.map(l => l.ligne);

      // 3. Construire les statistiques pour chaque ligne
      // ✅ FIX : grouper TOUTES les sessions d'une ligne (multi-références)
      const lineStats = await Promise.all(
        lignes.map(async (ligne) => {
          // ✅ TOUTES les sessions actives de cette ligne
          const lineSessions = activeSessions.filter(s => s.ligne === ligne);
          const activeSession = lineSessions[0] || null;

          const stats = await this.getLineStats(ligne, filters?.startDate, filters?.endDate);

          // ✅ Données temps réel pour chaque session (chaque référence)
          const multiSessions: any[] = [];
          for (const sess of lineSessions) {
            try {
              const rt = await this.getRealTimeProduction(sess.id);
              multiSessions.push(rt);
            } catch (error) {
              console.error(`Erreur temps réel session ${sess.id}:`, error);
            }
          }

          // Statut global : active si au moins une session active, sinon paused
          let globalStatus = 'inactive';
          if (lineSessions.length > 0) {
            globalStatus = lineSessions.some(s => s.status === 'active') ? 'active' : 'paused';
          }

          return {
            ligne,
            status: globalStatus,
            activeSession: activeSession ? {
              id: activeSession.id,
              startTime: activeSession.startTime,
              currentPause: activeSession.currentPause,
              productType: activeSession.productType,
              startedBy: activeSession.startedBy
            } : null,
            multiSessions,
            realTime: multiSessions[0] || null,
            historicalStats: stats
          };
        })
      );

      // 4. Statistiques globales avec syntaxe TypeORM correcte
      let whereCondition: any = {};
      
      if (filters?.startDate && filters?.endDate) {
        whereCondition.startTime = Between(filters.startDate, filters.endDate);
      } else if (filters?.startDate) {
        whereCondition.startTime = MoreThanOrEqual(filters.startDate);
      }

      const totalSessions = await this.productionSessionRepo.count({
        where: whereCondition
      });

      const totalPauses = await this.pauseSessionRepo.count({
        where: whereCondition
      });

      // Calculer les pièces perdues totales
      const allPauses = await this.pauseSessionRepo.find({
        where: whereCondition,
        select: ['lostPieces']
      });

      const totalLostPieces = allPauses.reduce((sum, p) => sum + (p.lostPieces || 0), 0);

      return {
        timestamp: now,
        filters: {
          startDate: filters?.startDate || null,
          endDate: filters?.endDate || null,
          ligne: filters?.ligne || 'all'
        },
        overview: {
          totalLines: lignes.length,
          // ✅ Compter par ligne (pas par session individuelle)
          activeLines: lineStats.filter(l => l.status === 'active').length,
          pausedLines: lineStats.filter(l => l.status === 'paused').length,
          inactiveLines: lineStats.filter(l => l.status === 'inactive').length,
          totalSessions,
          totalPauses,
          totalLostPieces
        },
        lines: lineStats.filter(l => {
          // Filtrer par ligne si spécifié
          if (filters?.ligne && filters.ligne !== 'all' && l.ligne !== filters.ligne) {
            return false;
          }
          // Filtrer par statut si spécifié
          if (filters?.status && filters.status !== 'all' && l.status !== filters.status) {
            return false;
          }
          return true;
        })
      };
    } catch (error) {
      console.error('Erreur dashboard admin:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération du dashboard admin');
    }
  }

  /**
   * 📈 Statistiques détaillées d'une période pour l'admin
   */
  async getAdminPeriodStats(startDate?: Date, endDate?: Date) {
    try {
      const queryBuilder = this.productionSessionRepo
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.pauses', 'pause');

      // ✅ Utilisation correcte des opérateurs TypeORM
      if (startDate && endDate) {
        queryBuilder.andWhere('session.startTime BETWEEN :startDate AND :endDate', {
          startDate,
          endDate
        });
      } else if (startDate) {
        queryBuilder.andWhere('session.startTime >= :startDate', { startDate });
      } else if (endDate) {
        queryBuilder.andWhere('session.startTime <= :endDate', { endDate });
      }

      const sessions = await queryBuilder.getMany();

      // Grouper par ligne
      const byLine: { [key: string]: any } = {};

      for (const session of sessions) {
        if (!byLine[session.ligne]) {
          byLine[session.ligne] = {
            ligne: session.ligne,
            totalSessions: 0,
            completedSessions: 0,
            totalProductionTime: 0,
            totalPauseTime: 0,
            totalPauses: 0,
            pausesByCategory: {},
            totalLostPieces: 0,
            totalProduced: 0
          };
        }

        const lineStats = byLine[session.ligne];
        lineStats.totalSessions++;
        
        if (session.status === 'completed') {
          lineStats.completedSessions++;
        }

        lineStats.totalProductionTime += session.totalProductionSeconds;
        lineStats.totalPauseTime += session.totalPauseSeconds;
        lineStats.totalProduced += session.quantityProduced || 0;

        // Analyser les pauses
        if (session.pauses) {
          for (const pause of session.pauses) {
            lineStats.totalPauses++;
            lineStats.totalLostPieces += pause.lostPieces || 0;

            if (!lineStats.pausesByCategory[pause.mCategory]) {
              lineStats.pausesByCategory[pause.mCategory] = {
                count: 0,
                totalDuration: 0,
                totalLostPieces: 0
              };
            }

            lineStats.pausesByCategory[pause.mCategory].count++;
            lineStats.pausesByCategory[pause.mCategory].totalDuration += pause.durationSeconds;
            lineStats.pausesByCategory[pause.mCategory].totalLostPieces += pause.lostPieces || 0;
          }
        }
      }

      // Formater les résultats
      const lineStatistics = Object.values(byLine).map((stat: any) => ({
        ligne: stat.ligne,
        totalSessions: stat.totalSessions,
        completedSessions: stat.completedSessions,
        totalProductionTime: this.formatDuration(stat.totalProductionTime),
        totalPauseTime: this.formatDuration(stat.totalPauseTime),
        totalPauses: stat.totalPauses,
        totalLostPieces: stat.totalLostPieces,
        totalProduced: stat.totalProduced,
        efficiency: this.calculateEfficiency(
          stat.totalProductionTime,
          stat.totalProductionTime + stat.totalPauseTime
        ),
        pausesByCategory: stat.pausesByCategory
      }));

      return {
        period: {
          startDate: startDate || 'Début',
          endDate: endDate || 'Fin'
        },
        totalSessions: sessions.length,
        lines: lineStatistics,
        globalStats: {
          totalProductionTime: lineStatistics.reduce((sum, l) => sum + parseInt(l.totalProductionTime), 0),
          totalPauseTime: lineStatistics.reduce((sum, l) => sum + parseInt(l.totalPauseTime), 0),
          totalPauses: lineStatistics.reduce((sum, l) => sum + l.totalPauses, 0),
          totalLostPieces: lineStatistics.reduce((sum, l) => sum + l.totalLostPieces, 0),
          totalProduced: lineStatistics.reduce((sum, l) => sum + l.totalProduced, 0)
        }
      };
    } catch (error) {
      console.error('Erreur stats période:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des statistiques');
    }
  }

  /**
   * 📋 Historique complet des pauses avec filtres admin
   */
  async getAdminPauseHistory(filters?: {
    startDate?: Date;
    endDate?: Date;
    ligne?: string;
    mCategory?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;

      const queryBuilder = this.pauseSessionRepo
        .createQueryBuilder('pause')
        .leftJoinAndSelect('pause.productionSession', 'session')
        .leftJoinAndSelect('pause.recordedBy', 'user')
        .orderBy('pause.startTime', 'DESC');

      // ✅ Filtres avec syntaxe TypeORM correcte
      if (filters?.startDate && filters?.endDate) {
        queryBuilder.andWhere('pause.startTime BETWEEN :startDate AND :endDate', {
          startDate: filters.startDate,
          endDate: filters.endDate
        });
      } else if (filters?.startDate) {
        queryBuilder.andWhere('pause.startTime >= :startDate', { startDate: filters.startDate });
      } else if (filters?.endDate) {
        queryBuilder.andWhere('pause.startTime <= :endDate', { endDate: filters.endDate });
      }

      if (filters?.ligne) {
        queryBuilder.andWhere('session.ligne = :ligne', { ligne: filters.ligne });
      }

      if (filters?.mCategory) {
        queryBuilder.andWhere('pause.mCategory = :mCategory', { mCategory: filters.mCategory });
      }

      const [pauses, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        pauses: pauses.map(p => ({
          id: p.id,
          ligne: p.productionSession.ligne,
          sessionId: p.productionSession.id,
          mCategory: p.mCategory,
          subCategory: p.subCategory,
          startTime: p.startTime,
          endTime: p.endTime,
          duration: this.formatDuration(p.durationSeconds),
          durationSeconds: p.durationSeconds,
          reason: p.reason,
          actionTaken: p.actionTaken,
          lostPieces: p.lostPieces,
          matierePremierRefs: p.matierePremierRefs,
          phasesEnPanne: p.phasesEnPanne,
          productRefs: p.productRefs,
          recordedBy: p.recordedBy ? `${p.recordedBy.prenom} ${p.recordedBy.nom}` : 'Inconnu'
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Erreur historique pauses admin:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération de l\'historique');
    }
  }

  /**
   * 📊 Statistiques par catégorie M (pour graphiques)
   */
  async getAdminMCategoryStats(startDate?: Date, endDate?: Date) {
    try {
      const queryBuilder = this.pauseSessionRepo
        .createQueryBuilder('pause')
        .select('pause.mCategory', 'category')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(pause.durationSeconds)', 'totalDuration')
        .addSelect('SUM(pause.lostPieces)', 'totalLostPieces')
        .groupBy('pause.mCategory');

      // ✅ Filtres avec syntaxe TypeORM correcte
      if (startDate && endDate) {
        queryBuilder.andWhere('pause.startTime BETWEEN :startDate AND :endDate', {
          startDate,
          endDate
        });
      } else if (startDate) {
        queryBuilder.andWhere('pause.startTime >= :startDate', { startDate });
      } else if (endDate) {
        queryBuilder.andWhere('pause.startTime <= :endDate', { endDate });
      }

      const results = await queryBuilder.getRawMany();

      return {
        categories: results.map(r => ({
          category: r.category,
          count: parseInt(r.count),
          totalDuration: this.formatDuration(parseInt(r.totalDuration || '0')),
          totalDurationSeconds: parseInt(r.totalDuration || '0'),
          totalLostPieces: parseInt(r.totalLostPieces || '0'),
          averageDuration: this.formatDuration(
            Math.floor(parseInt(r.totalDuration || '0') / parseInt(r.count))
          )
        }))
      };
    } catch (error) {
      console.error('Erreur stats M categories:', error);
      throw new InternalServerErrorException('Erreur lors de la récupération des stats M');
    }
  }

  async getPlannedReferencesForLine(ligne: string): Promise<{
  planifications: Array<{
    id: number;
    reference: string;
    of: string;
    jour: string;
    semaine: string;
    qtePlanifiee: number;
    qteModifiee: number;
  }>;
  total: number;
  currentWeek: string | null;
}> {
  try {
    // ✅ FIX : formater la date en 'YYYY-MM-DD' pour comparer avec les colonnes DATE en BDD
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // ex: '2026-03-14'

    // ✅ Déterminer le jour de la semaine en français (minuscules)
    const joursMap: Record<number, string> = {
      0: 'dimanche', // non utilisé
      1: 'lundi',
      2: 'mardi',
      3: 'mercredi',
      4: 'jeudi',
      5: 'vendredi',
      6: 'samedi',
    };
    const jourActuel = joursMap[today.getDay()];

    console.log('[getPlannedReferencesForLine] ligne:', ligne, '| date:', todayStr, '| jour:', jourActuel);

    // 1. Trouver la semaine courante (today entre dateDebut et dateFin)
    const currentSemaine = await this.semaineRepo
      .createQueryBuilder('semaine')
      .where('DATE(semaine.dateDebut) <= :today', { today: todayStr })
      .andWhere('DATE(semaine.dateFin) >= :today', { today: todayStr })
      .getOne();

    console.log('[getPlannedReferencesForLine] semaine trouvée:', currentSemaine?.nom ?? 'AUCUNE');

    if (!currentSemaine) {
      return { planifications: [], total: 0, currentWeek: null };
    }

    // 2. Récupérer les planifications du jour actuel uniquement
    //    pour la semaine courante avec un OF non vide
    const planifications = await this.planificationRepo.find({
      where: {
        ligne,
        semaine: currentSemaine.nom,
        jour: jourActuel,          // ✅ Filtre sur le jour actuel
        of: Not(''),
      },
      order: { reference: 'ASC' }
    });

    console.log(`[getPlannedReferencesForLine] ${planifications.length} planification(s) pour ${ligne} - ${currentSemaine.nom} - ${jourActuel}`);

    return {
      planifications: planifications.map(p => ({
        id: p.id,
        reference: p.reference,
        of: p.of,
        jour: p.jour,
        semaine: p.semaine,
        qtePlanifiee: p.qtePlanifiee,
        qteModifiee: p.qteModifiee,
      })),
      total: planifications.length,
      currentWeek: currentSemaine.nom
    };

  } catch (error) {
    console.error(`[getPlannedReferencesForLine] Erreur:`, error);
    throw new InternalServerErrorException('Erreur lors de la récupération des références planifiées');
  }
}


}