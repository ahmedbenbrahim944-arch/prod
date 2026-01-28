// src/temps-sec/temps-sec.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  UseGuards,
  Request,
  UsePipes, 
  ValidationPipe,
  ParseIntPipe
} from '@nestjs/common';
import { TempsSecService } from './temps-sec.service';
import { CreateTempsSecDto } from './dto/create-temps-sec.dto';
import { UpdateTempsSecDto } from './dto/update-temps-sec.dto';
import { UpdateTempsSecByRefDto } from './dto/update-temps-sec-by-ref.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('temps')
export class TempsSecController {
  constructor(private readonly tempsSecService: TempsSecService) {}

  // Créer un temps sec - Admin seulement
  @Post()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createTempsSecDto: CreateTempsSecDto, @Request() req) {
    const adminId = req.user.id;
    const tempsSec = await this.tempsSecService.createTempsSec(createTempsSecDto, adminId);
    
    return {
      message: 'Temps sec créé avec succès',
      data: {
        id: tempsSec.id,
        ligne: tempsSec.ligne,
        reference: tempsSec.reference,
        seconde: tempsSec.seconde,
      },
    };
  }

  // Modifier un temps sec par ligne et référence - Admin seulement
  @Patch()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateByLigneAndReference(@Body() updateTempsSecByRefDto: UpdateTempsSecByRefDto) {
    const tempsSec = await this.tempsSecService.updateByLigneAndReference(updateTempsSecByRefDto);
    
    return {
      message: 'Temps sec modifié avec succès',
      data: {
        id: tempsSec.id,
        ligne: tempsSec.ligne,
        reference: tempsSec.reference,
        seconde: tempsSec.seconde,
      },
    };
  }

  // Créer ou mettre à jour un temps sec (UPSERT) - Admin seulement
  @Post('upsert')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createOrUpdate(@Body() createOrUpdateDto: CreateTempsSecDto, @Request() req) {
    const adminId = req.user.id;
    const tempsSec = await this.tempsSecService.createOrUpdateTempsSec(createOrUpdateDto, adminId);
    
    
    return {
      message: `Temps sec  avec succès`,
      data: {
        id: tempsSec.id,
        ligne: tempsSec.ligne,
        reference: tempsSec.reference,
        seconde: tempsSec.seconde,
        
      },
    };
  }

  // Récupérer tous les temps sec - Accessible par tous (avec auth)
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return await this.tempsSecService.findAll();
  }

  // Récupérer les temps par ligne - Accessible par tous (avec auth)
  @Get('ligne/:ligne')
  @UseGuards(JwtAuthGuard)
  async findByLigne(@Param('ligne') ligne: string) {
    return await this.tempsSecService.findByLigne(ligne);
  }

  // Récupérer un temps sec par ID - Accessible par tous (avec auth)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.tempsSecService.findOne(id);
  }

  // Récupérer un temps sec par ligne et référence - Accessible par tous (avec auth)
  @Get('ligne/:ligne/reference/:reference')
  @UseGuards(JwtAuthGuard)
  async findByLigneAndReference(
    @Param('ligne') ligne: string,
    @Param('reference') reference: string
  ) {
    return await this.tempsSecService.findByLigneAndReference(ligne, reference);
  }

  // Modifier un temps sec par ID - Admin seulement
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateTempsSecDto: UpdateTempsSecDto
  ) {
    const tempsSec = await this.tempsSecService.update(id, updateTempsSecDto);
    
    return {
      message: 'Temps sec modifié avec succès',
      data: {
        id: tempsSec.id,
        ligne: tempsSec.ligne,
        reference: tempsSec.reference,
        seconde: tempsSec.seconde
      },
    };
  }

  // Supprimer un temps sec par ID - Admin seulement
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.tempsSecService.remove(id);
    return { message: 'Temps sec supprimé avec succès' };
  }

  // Supprimer un temps sec par ligne et référence - Admin seulement
  @Delete('ligne/:ligne/reference/:reference')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async removeByLigneAndReference(
    @Param('ligne') ligne: string,
    @Param('reference') reference: string
  ) {
    await this.tempsSecService.removeByLigneAndReference(ligne, reference);
    return { message: 'Temps sec supprimé avec succès' };
  }
}