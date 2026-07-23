// src/matiere-premier/matiere-premier.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  UseGuards,
  UsePipes, 
  ValidationPipe,
  ParseIntPipe
} from '@nestjs/common';
import { MatierePremierService } from './matiere-premier.service';
import { CreateMatierePremierDto } from './dto/create-matiere-premier.dto';
import { UpdateMatierePremierDto } from './dto/update-matiere-premier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('matiere-pre')
export class MatierePremierController {
  constructor(private readonly matierePremierService: MatierePremierService) {}

  // Créer une matière première - User seulement
  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createMatierePremierDto: CreateMatierePremierDto) {
    const matierePremier = await this.matierePremierService.createMatierePremier(createMatierePremierDto);
    
    return {
      message: 'Matière première créée avec succès',
      data: {
        id: matierePremier.id,
        ligne: matierePremier.ligne,
        refMatierePremier: matierePremier.refMatierePremier
      },
    };
  }

  // Récupérer toutes les matières premières - Accessible par tous les users (avec auth)
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return await this.matierePremierService.findAll();
  }

  // Récupérer toutes les lignes distinctes
  @Get('lignes')
  @UseGuards(JwtAuthGuard)
  async findAllLignes() {
    const lignes = await this.matierePremierService.findAllLignes();
    return { lignes };
  }

  // Récupérer toutes les références matière première distinctes
  @Get('refs')
  @UseGuards(JwtAuthGuard)
  async findAllRefs() {
    const refs = await this.matierePremierService.findAllRefMatierePremier();
    return { refMatierePremier: refs };
  }

  // Récupérer les matières premières par ligne - Accessible par tous les users (avec auth)
  @Get('ligne/:ligne')
  @UseGuards(JwtAuthGuard)
  async findByLigne(@Param('ligne') ligne: string) {
    return await this.matierePremierService.findByLigne(ligne);
  }

  // Récupérer une matière première par ID - Accessible par tous les users (avec auth)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.matierePremierService.findOne(id);
  }

  // Modifier une matière première par ID - User seulement
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateMatierePremierDto: UpdateMatierePremierDto
  ) {
    const matierePremier = await this.matierePremierService.update(id, updateMatierePremierDto);
    
    return {
      message: 'Matière première modifiée avec succès',
      data: {
        id: matierePremier.id,
        ligne: matierePremier.ligne,
        refMatierePremier: matierePremier.refMatierePremier
      },
    };
  }

  // Supprimer une matière première par ID - User seulement
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.matierePremierService.remove(id);
    return { message: 'Matière première supprimée avec succès' };
  }

  // Supprimer une matière première par ligne et référence - User seulement
  @Delete('ligne/:ligne/ref/:ref')
  @UseGuards(JwtAuthGuard)
  async removeByLigneAndRef(
    @Param('ligne') ligne: string,
    @Param('ref') ref: string
  ) {
    await this.matierePremierService.removeByLigneAndRef(ligne, ref);
    return { message: 'Matière première supprimée avec succès' };
  }
}