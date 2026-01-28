// src/ouvrier/ouvrier.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete,
  UseGuards,
  UsePipes, 
  ValidationPipe,
  ParseIntPipe
} from '@nestjs/common';
import { OuvrierService } from './ouvrier.service';
import { CreateOuvrierDto } from './dto/create-ouvrier.dto';
import { SearchOuvrierDto } from './dto/search-ouvrier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('ouvrier')
export class OuvrierController {
  constructor(private readonly ouvrierService: OuvrierService) {}

  // Créer un ouvrier - Accessible seulement par admin
  @Post()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createOuvrierDto: CreateOuvrierDto) {
    const ouvrier = await this.ouvrierService.createOuvrier(createOuvrierDto);
    
    return {
      message: 'Ouvrier créé avec succès',
      ouvrier: {
        matricule: ouvrier.matricule,
        nomPrenom: ouvrier.nomPrenom,
       
      },
    };
  }

  // Rechercher un ouvrier par matricule (via body) - Accessible par admin et user
  @Post('search')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async searchByMatricule(@Body() searchOuvrierDto: SearchOuvrierDto) {
    const result = await this.ouvrierService.searchByMatricule(searchOuvrierDto);
    
    return {
      matricule: result.matricule,
      nomPrenom: result.nomPrenom
    };
  }

  // Récupérer tous les ouvriers - Accessible par admin et user
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return await this.ouvrierService.findAll();
  }

  // Supprimer un ouvrier - Accessible seulement par admin
  @Delete(':matricule')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(@Param('matricule', ParseIntPipe) matricule: number) {
    await this.ouvrierService.remove(matricule);
    return { message: 'Ouvrier supprimé avec succès' };
  }
}