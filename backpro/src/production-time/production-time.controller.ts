import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  Patch
} from '@nestjs/common';
import { ProductionTimeService } from './production-time.service';
import { StartProductionDto } from './dto/start-production.dto';
import { PauseProductionDto } from './dto/pause-production.dto';
import { ResumeProductionDto } from './dto/resume-production.dto';
import { EndProductionDto } from './dto/end-production.dto';
import { UpdatePauseDto } from './dto/update-pause.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminDashboardFilterDto } from './dto/admin-dashboard-filter.dto';

@Controller('production')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ProductionTimeController {
  constructor(private readonly productionTimeService: ProductionTimeService) {}

  /**
   * Démarrer une nouvelle session de production
   */
  @Post('start')
  async startProduction(@Body() startDto: StartProductionDto, @Req() req) {
    return this.productionTimeService.startProduction(startDto, req.user);
  }

  /**
   * Mettre en pause la production (pour une catégorie M)
   */
  @Post('pause')
  async pauseProduction(@Body() pauseDto: PauseProductionDto, @Req() req) {
    return this.productionTimeService.pauseProduction(pauseDto, req.user);
  }

  /**
   * Reprendre la production après une pause
   */
  @Post('resume')
  async resumeProduction(@Body() resumeDto: ResumeProductionDto, @Req() req) {
    return this.productionTimeService.resumeProduction(resumeDto, req.user);
  }

  /**
   * Terminer la session de production
   */
  @Post('end')
  async endProduction(@Body() endDto: EndProductionDto, @Req() req) {
    return this.productionTimeService.endProduction(endDto, req.user);
  }

  /**
   * Mettre à jour les détails d'une pause
   */
  @Patch('pause/update')
  async updatePause(@Body() updateDto: UpdatePauseDto, @Req() req) {
    return this.productionTimeService.updatePause(updateDto, req.user);
  }

  /**
   * Annuler une session
   */
  @Post('cancel/:sessionId')
  async cancelSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req
  ) {
    return this.productionTimeService.cancelSession(sessionId, req.user);
  }

  /**
   * Obtenir les statistiques d'une session
   */
  @Get('session/:sessionId/stats')
  async getSessionStats(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.productionTimeService.getSessionStats(sessionId);
  }

  /**
   * Obtenir les statistiques d'une ligne
   */
  @Get('line/:ligne/stats')
  async getLineStats(
    @Param('ligne') ligne: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.productionTimeService.getLineStats(ligne, start, end);
  }

  /**
   * Obtenir toutes les sessions actives
   */
  @Get('active')
  async getActiveSessions() {
    return this.productionTimeService.getActiveSessions();
  }

  /**
   * Obtenir l'historique des sessions
   */
  @Get('history')
  async getSessionHistory(
    @Query('ligne') ligne?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number
  ) {
    return this.productionTimeService.getSessionHistory(ligne, page, limit);
  }

  /**
   * 🆕 Obtenir les références disponibles pour une ligne selon la catégorie M
   */
  @Get('line/:ligne/references/:mCategory')
  async getAvailableReferences(
    @Param('ligne') ligne: string,
    @Param('mCategory') mCategory: string
  ) {
    return this.productionTimeService.getAvailableReferencesForPause(ligne, mCategory);
  }

  /**
   * Obtenir les catégories M disponibles
   */
  @Get('m-categories')
  async getMCategories() {
    return {
      categories: [
        {
          code: 'M1',
          name: 'Matière Première',
          description: 'Problèmes liés aux matières premières',
          subCategories: ['Qualité insuffisante', 'Rupture de stock', 'Livraison retardée'],
          requiresReferences: true,
          referenceType: 'matierePremiere'
        },
        {
          code: 'M2',
          name: 'Main d\'œuvre',
          description: 'Problèmes liés au personnel',
          subCategories: ['Absence', 'Formation insuffisante', 'Rendement faible'],
          requiresReferences: false
        },
        {
          code: 'M3',
          name: 'Méthode',
          description: 'Problèmes liés aux méthodes de travail',
          subCategories: ['Procédure incorrecte', 'Documentation manquante', 'Erreur de méthode'],
          requiresReferences: false
        },
        {
          code: 'M4',
          name: 'Maintenance',
          description: 'Problèmes liés aux machines et équipements',
          subCategories: ['Panne machine', 'Maintenance préventive', 'Réglage nécessaire'],
          requiresReferences: true,
          referenceType: 'phases'
        },
        {
          code: 'M5',
          name: 'Qualité',
          description: 'Problèmes liés au contrôle qualité',
          subCategories: ['Défaut produit', 'Contrôle qualité', 'Rejet de lot'],
          requiresReferences: true,
          referenceType: 'products'
        },
        {
          code: 'M6',
          name: 'Environnement',
          description: 'Problèmes liés à l\'environnement de travail',
          subCategories: ['Température', 'Éclairage', 'Sécurité', 'Nettoyage'],
          requiresReferences: false
        }
      ]
    };
  }

  /**
   * Vérifier l'état d'une ligne
   */
  @Get('line/:ligne/status')
  async getLineStatus(@Param('ligne') ligne: string) {
    const activeSession = await this.productionTimeService.getActiveSessions();
    const lineSession = activeSession.find(s => s.ligne === ligne);
    
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
      productType: lineSession.productType
    };
  }

  @Get('session/:sessionId/realtime')
async getRealTimeProduction(@Param('sessionId', ParseIntPipe) sessionId: number) {
  return this.productionTimeService.getRealTimeProduction(sessionId);
}

/**
 * Obtenir les statistiques en temps réel pour toutes les lignes actives
 */
@Get('realtime/all')
async getAllRealTimeProduction() {
  const activeSessions = await this.productionTimeService.getActiveSessions();
  const realTimeData = await Promise.all(
    activeSessions.map(session => 
      this.productionTimeService.getRealTimeProduction(session.id)
        .catch(() => null) // Ignorer les erreurs individuelles
    )
  );
  
  return realTimeData.filter(data => data !== null);
}
 @Get('admin/dashboard')
  async getAdminDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('ligne') ligne?: string,
    @Query('status') status?: string
  ) {
    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      ligne: ligne || undefined,
      status: status || undefined
    };

    return this.productionTimeService.getAdminDashboardOverview(filters);
  }

  /**
   * 📈 Statistiques de période pour admin
   * GET /production/admin/period-stats
   */
  @Get('admin/period-stats')
  async getAdminPeriodStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.productionTimeService.getAdminPeriodStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  /**
   * 📋 Historique des pauses pour admin
   * GET /production/admin/pause-history
   */
  @Get('admin/pause-history')
  async getAdminPauseHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('ligne') ligne?: string,
    @Query('mCategory') mCategory?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number
  ) {
    return this.productionTimeService.getAdminPauseHistory({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      ligne,
      mCategory,
      page,
      limit
    });
  }

  /**
   * 📊 Statistiques par catégorie M
   * GET /production/admin/m-category-stats
   */
  @Get('admin/m-category-stats')
  async getAdminMCategoryStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.productionTimeService.getAdminMCategoryStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  /**
   * 📊 Export CSV des données (optionnel)
   * GET /production/admin/export
   */
  @Get('admin/export')
  async exportAdminData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format: 'csv' | 'json' = 'json'
  ) {
    const data = await this.productionTimeService.getAdminPeriodStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    // Pour CSV, vous pouvez ajouter une bibliothèque comme 'json2csv'
    // Pour l'instant, retournons le JSON
    return data;
  }
}