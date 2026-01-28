// src/non-conf/non-conf.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Delete,
  UseGuards,
  UsePipes, 
  ValidationPipe,
  Query,
  Param,
  ParseIntPipe,
  Patch,
  HttpCode,
  HttpStatus,
  BadRequestException
} from '@nestjs/common';
import { NonConfService } from './non-conf.service';
import { CreateOrUpdateNonConfDto } from './dto/create-or-update-non-conf.dto';
import { GetNonConfDto } from './dto/get-non-conf.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { GetTotalEcartDto } from './dto/get-total-ecart.dto';
import { GetNonConfByDateDto } from './dto/get-non-conf-by-date.dto';

@Controller('nonconf')
export class NonConfController {
  constructor(private readonly nonConfService: NonConfService) {}

  // ==================== UPSERT (CRÉER OU METTRE À JOUR) ====================
  @Patch()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async createOrUpdateNonConformite(
    @Body() createOrUpdateNonConfDto: CreateOrUpdateNonConfDto
    // ✅ SUPPRIMÉ : Plus de paramètre @Req() req
  ) {
    // ✅ MODIFIÉ : Plus besoin de passer req.user
    return this.nonConfService.createOrUpdateNonConformite(createOrUpdateNonConfDto);
  }

  // ==================== GET ALL (AVEC FILTRES) ====================
  @Get()
  @UseGuards(JwtAuthGuard)
  async getNonConformites(@Query() getNonConfDto: GetNonConfDto) {
    return this.nonConfService.getNonConformites(getNonConfDto);
  }

  // ==================== GET BY ID ====================
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getNonConformiteById(@Param('id', ParseIntPipe) id: number) {
    return this.nonConfService.getNonConformiteById(id);
  }

  // ==================== GET BY CRITERIA ====================
  @Post('recherche')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getNonConformiteByCriteria(@Body() getNonConfDto: GetNonConfDto) {
    const { semaine, jour, ligne, reference } = getNonConfDto;
    
    if (!semaine || !jour || !ligne || !reference) {
      throw new BadRequestException('Tous les champs (semaine, jour, ligne, référence) sont requis');
    }
    
    return this.nonConfService.getNonConformiteByCriteria(semaine, jour, ligne, reference);
  }

  // ==================== STATISTIQUES ====================
  @Get('stats/total')
  @UseGuards(JwtAuthGuard)
  async getStats(@Query('semaine') semaine?: string) {
    return this.nonConfService.getStats(semaine);
  }

  // ==================== DELETE BY ID (ADMIN) ====================
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async deleteNonConformite(@Param('id', ParseIntPipe) id: number) {
    return this.nonConfService.deleteNonConformite(id);
  }

  // ==================== DELETE BY CRITERIA (ADMIN) ====================
  @Delete()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async deleteNonConformiteByCriteria(@Body() getNonConfDto: GetNonConfDto) {
    const { semaine, jour, ligne, reference } = getNonConfDto;
    
    if (!semaine || !jour || !ligne || !reference) {
      throw new BadRequestException('Tous les critères (semaine, jour, ligne, référence) sont requis pour la suppression');
    }
    
    return this.nonConfService.deleteNonConformiteByCriteria(semaine, jour, ligne, reference);
  }

  // ==================== VÉRIFIER L'EXISTENCE ====================
  @Post('exists')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async checkNonConformiteExists(@Body() getNonConfDto: GetNonConfDto) {
    const { semaine, jour, ligne, reference } = getNonConfDto;
    
    if (!semaine || !jour || !ligne || !reference) {
      throw new BadRequestException('Tous les champs (semaine, jour, ligne, référence) sont requis');
    }
    
    const result = await this.nonConfService.getNonConformiteByCriteria(semaine, jour, ligne, reference);
    
    return {
      exists: result.exists,
      message: result.message,
      data: result.exists ? result.data : null
    };
  }

  // ==================== ENDPOINT PUBLIC POUR TEST ====================
  @Get('debug/test')
  async testEndpoint() {
    return {
      message: 'API Non-Conformité fonctionnelle',
      endpoints: [
        { method: 'PATCH', path: '/nonconf', description: 'Créer ou mettre à jour un rapport' },
        { method: 'GET', path: '/nonconf', description: 'Récupérer tous les rapports (avec filtres)' },
        { method: 'GET', path: '/nonconf/:id', description: 'Récupérer un rapport par ID' },
        { method: 'POST', path: '/nonconf/recherche', description: 'Rechercher un rapport par critères' },
        { method: 'POST', path: '/nonconf/exists', description: 'Vérifier l\'existence d\'un rapport' },
        { method: 'GET', path: '/nonconf/stats/total', description: 'Statistiques' },
        { method: 'DELETE', path: '/nonconf/:id', description: 'Supprimer un rapport par ID (Admin)' },
        { method: 'DELETE', path: '/nonconf', description: 'Supprimer un rapport par critères (Admin)' }
      ],
      version: '1.0.0',
      timestamp: new Date().toISOString()
    };
  }
  @Post('vu/total-ecart')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getTotalEcartPourcentage(@Body() getTotalEcartDto: GetTotalEcartDto) {
    const { semaine, ligne, reference } = getTotalEcartDto;
    
    return this.nonConfService.getTotalEcartPourcentage(semaine, ligne, reference);
  }

  @Post('filter/by-date-ligne')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getNonConformitesByDateAndLigne(
    @Body() filterDto: GetNonConfByDateDto
  ) {
    return this.nonConfService.getNonConformitesByDateAndLigne(filterDto);
  }
}