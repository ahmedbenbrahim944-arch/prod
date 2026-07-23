// src/production/production.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ProductionService } from './production.service';
import { CreateProductionDto } from './dto/create-production.dto';
import { SearchProductionDto } from './dto/search-production.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // POST /production/scan
  // Scanner un QR code et enregistrer la production
  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.CREATED)
  async scanProduction(@Body() dto: CreateProductionDto) {
    const record = await this.productionService.scanProduction(dto);
    return {
      message: 'Production enregistrée avec succès',
      data: record,
    };
  }

  // POST /production/search
  // Recherche avancée
  @Post('search')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async searchProductions(@Body() searchDto: SearchProductionDto) {
    return this.productionService.searchProductions(searchDto);
  }

  // GET /production/ligne/:ligne
  // Production par ligne avec plage de dates
  @Get('ligne/:ligne')
  @UseGuards(JwtAuthGuard)
  async getProductionByLigne(
    @Param('ligne') ligne: string,
    @Query('dateDebut') dateDebut: string,
    @Query('dateFin') dateFin: string,
  ) {
    if (!dateDebut || !dateFin) {
      throw new Error('Les paramètres dateDebut et dateFin sont requis');
    }
    return this.productionService.getProductionByLigneAndDate(
      ligne,
      new Date(dateDebut),
      new Date(dateFin),
    );
  }

  // GET /production/stats
  // Statistiques globales
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.productionService.getStats();
  }

  // GET /production
  // Tous les enregistrements (paginated)
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 50,
  ) {
    return this.productionService.findAll(page, limit);
  }

  // GET /production/:id
  // Un enregistrement par id
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productionService.findOne(id);
  }

  // DELETE /production/:id
  // Supprimer un enregistrement (admin seulement)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.productionService.remove(id);
  }
}