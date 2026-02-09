// src/saisie-non-conf/saisie-non-conf.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { SaisieNonConfService } from './saisie-non-conf.service';
import { CreateSaisieNonConfDto } from './dto/create-saisie-non-conf.dto';
import { UpdateSaisieNonConfDto } from './dto/update-saisie-non-conf.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('saisie-non-conf')
export class SaisieNonConfController {
  constructor(private readonly saisieNonConfService: SaisieNonConfService) {}

  // ============ CRUD ============ //
  
  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createSaisieNonConfDto: CreateSaisieNonConfDto) {
    return await this.saisieNonConfService.create(createSaisieNonConfDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return await this.saisieNonConfService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const saisie = await this.saisieNonConfService.findOne(+id);
    if (!saisie) {
      throw new NotFoundException(`Saisie avec ID ${id} non trouvée`);
    }
    return saisie;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string,
    @Body() updateSaisieNonConfDto: UpdateSaisieNonConfDto,
  ) {
    return await this.saisieNonConfService.update(+id, updateSaisieNonConfDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    await this.saisieNonConfService.remove(+id);
    return { message: 'Saisie supprimée avec succès' };
  }

  // ============ GESTION DES STATUTS ============ //
  
  @Patch(':id/statut')
  @UseGuards(JwtAuthGuard)
  async updateStatut(
    @Param('id') id: string,
    @Body() body: { statut: string }
  ) {
    if (!body.statut) {
      throw new BadRequestException('Le champ statut est requis');
    }

    const statutsValides = ['en attente', 'déclaré'];
    if (!statutsValides.includes(body.statut)) {
      throw new BadRequestException(`Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}`);
    }

    const saisie = await this.saisieNonConfService.updateStatut(+id, body.statut);
    
    return {
      message: `Statut mis à jour avec succès`,
      data: saisie
    };
  }

  @Get('api/statuts')
  @UseGuards(JwtAuthGuard)
  async getStatutsList() {
    const statuts = ['en attente', 'déclaré'];
    return {
      message: 'Liste des statuts disponibles',
      data: statuts
    };
  }

  @Get('api/by-statut/:statut')
  @UseGuards(JwtAuthGuard)
  async findByStatut(@Param('statut') statut: string) {
    const statutsValides = ['en attente', 'déclaré'];
    if (!statutsValides.includes(statut)) {
      throw new BadRequestException(`Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}`);
    }

    const results = await this.saisieNonConfService.findByStatut(statut);
    return {
      message: `Saisies avec le statut "${statut}" récupérées avec succès`,
      statut: statut,
      data: results,
      count: results.length
    };
  }

  @Get('api/statuts/count')
  @UseGuards(JwtAuthGuard)
  async getCountByStatut() {
    const enAttente = await this.saisieNonConfService.findByStatut('en attente');
    const declare = await this.saisieNonConfService.findByStatut('déclaré');
    
    return {
      message: 'Nombre de saisies par statut',
      data: {
        'en attente': enAttente.length,
        'déclaré': declare.length,
        total: enAttente.length + declare.length
      }
    };
  }

  // ============ LIGNES ============ //
  
  @Get('api/lines')
  @UseGuards(JwtAuthGuard)
  async getAllLines() {
    const lines = await this.saisieNonConfService.getAllLines();
    return {
      message: 'Lignes récupérées avec succès',
      data: lines,
      count: lines.length
    };
  }

  @Get('api/references/by-line/:ligne')
  @UseGuards(JwtAuthGuard)
  async getReferencesByLine(@Param('ligne') ligne: string) {
    if (!ligne) {
      throw new BadRequestException('Le paramètre ligne est requis');
    }
    
    const references = await this.saisieNonConfService.getReferencesByLine(ligne);
    return {
      message: `Références pour la ligne ${ligne} récupérées avec succès`,
      ligne: ligne,
      data: references,
      count: references.length
    };
  }

  // ============ RECHERCHE ============ //
  
  @Get('api/search')
  @UseGuards(JwtAuthGuard)
  async search(
    @Query('ligne') ligne?: string,
    @Query('reference') reference?: string,
    @Query('sourceType') sourceType?: string,
    @Query('type') type?: string,
    @Query('statut') statut?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = {
      ligne,
      reference,
      sourceType,
      type,
      statut,
      startDate,
      endDate
    };
    
    // Validation du statut si fourni
    if (statut) {
      const statutsValides = ['en attente', 'déclaré'];
      if (!statutsValides.includes(statut)) {
        throw new BadRequestException(`Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}`);
      }
    }
    
    const results = await this.saisieNonConfService.search(filters);
    return {
      message: 'Recherche effectuée avec succès',
      filters,
      data: results,
      count: results.length
    };
  }

  // ============ STATISTIQUES ============ //
  
  @Get('api/stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    const stats = await this.saisieNonConfService.getStats();
    return {
      message: 'Statistiques récupérées avec succès',
      data: stats
    };
  }

  @Get('api/stats/lines')
  @UseGuards(JwtAuthGuard)
  async getStatsByLine() {
    const stats = await this.saisieNonConfService.getStatsByLine();
    return {
      message: 'Statistiques par ligne récupérées avec succès',
      data: stats
    };
  }

  @Get('api/stats/types')
  @UseGuards(JwtAuthGuard)
  async getStatsByType() {
    const stats = await this.saisieNonConfService.getStatsByType();
    return {
      message: 'Statistiques par type récupérées avec succès',
      data: stats
    };
  }

  @Get('api/stats/statuts')
  @UseGuards(JwtAuthGuard)
  async getStatsByStatut() {
    const stats = await this.saisieNonConfService.getStatsByStatut();
    return {
      message: 'Statistiques par statut récupérées avec succès',
      data: stats
    };
  }

  // ============ DONNÉES MÉTIER ============ //
  
  @Get('api/defauts')
  @UseGuards(JwtAuthGuard)
  async getDefautsList() {
    const defauts = await this.saisieNonConfService.getDefautsList();
    return {
      message: 'Liste des défauts récupérée avec succès',
      data: defauts,
      count: defauts.length
    };
  }

  @Get('api/all-references')
  @UseGuards(JwtAuthGuard)
  async getAllReferencesWithLines() {
    const references = await this.saisieNonConfService.getAllReferencesWithLines();
    return {
      message: 'Toutes les références récupérées avec succès',
      data: references,
      count: references.length
    };
  }

  // ============ RECHERCHE PAR CRITÈRES ============ //
  
  @Get('api/by-line/:ligne')
  @UseGuards(JwtAuthGuard)
  async findByLine(@Param('ligne') ligne: string) {
    const results = await this.saisieNonConfService.findByLine(ligne);
    return {
      message: `Saisies pour la ligne ${ligne} récupérées avec succès`,
      ligne: ligne,
      data: results,
      count: results.length
    };
  }

  @Get('api/by-reference/:reference')
  @UseGuards(JwtAuthGuard)
  async findByReference(@Param('reference') reference: string) {
    const results = await this.saisieNonConfService.findByReference(reference);
    return {
      message: `Saisies pour la référence ${reference} récupérées avec succès`,
      reference: reference,
      data: results,
      count: results.length
    };
  }

  // ============ RECHERCHE PAR PÉRIODE ============ //
  
  @Get('api/date-range')
  @UseGuards(JwtAuthGuard)
  async findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('Les paramètres startDate et endDate sont requis');
    }
    
    const results = await this.saisieNonConfService.findByDateRange(startDate, endDate);
    return {
      message: `Saisies entre ${startDate} et ${endDate} récupérées avec succès`,
      startDate,
      endDate,
      data: results,
      count: results.length
    };
  }
}