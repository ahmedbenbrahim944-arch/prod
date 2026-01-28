// src/phase/phase.controller.ts
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
import { PhaseService } from './phase.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('phase')
export class PhaseController {
  constructor(private readonly phaseService: PhaseService) {}

  // Créer une phase - Admin seulement
  @Post()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createPhaseDto: CreatePhaseDto) {
    const phase = await this.phaseService.createPhase(createPhaseDto);
    
    return {
      message: 'Phase créée avec succès',
      data: {
        id: phase.id,
        ligne: phase.ligne,
        phase: phase.phase
      },
    };
  }

  // Récupérer toutes les phases - Accessible par tous (avec auth)
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return await this.phaseService.findAll();
  }

  // Récupérer toutes les lignes distinctes
  @Get('lignes')
  @UseGuards(JwtAuthGuard)
  async findAllLignes() {
    const lignes = await this.phaseService.findAllLignes();
    return { lignes };
  }

  // Récupérer les phases par ligne - Accessible par tous (avec auth)
  // Dans phase.controller.ts
@Get('ligne/:ligne')
@UseGuards(JwtAuthGuard)
async findByLigne(@Param('ligne') ligne: string) {
  const phases = await this.phaseService.findByLigne(ligne);
  // Retourner un tableau simple des numéros de phase
  return phases.map(phase => phase.phase);
}

  // Récupérer une phase par ID - Accessible par tous (avec auth)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.phaseService.findOne(id);
  }

  // Modifier une phase par ID - Admin seulement
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updatePhaseDto: UpdatePhaseDto
  ) {
    const phase = await this.phaseService.update(id, updatePhaseDto);
    
    return {
      message: 'Phase modifiée avec succès',
      data: {
        id: phase.id,
        ligne: phase.ligne,
        phase: phase.phase
      },
    };
  }

  // Supprimer une phase par ID - Admin seulement
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.phaseService.remove(id);
    return { message: 'Phase supprimée avec succès' };
  }

  // Supprimer une phase par ligne et numéro - Admin seulement
  @Delete('ligne/:ligne/phase/:phase')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async removeByLigneAndPhase(
    @Param('ligne') ligne: string,
    @Param('phase') phase: string
  ) {
    await this.phaseService.removeByLigneAndPhase(ligne, phase);
    return { message: 'Phase supprimée avec succès' };
  }
}