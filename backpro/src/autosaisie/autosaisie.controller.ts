// src/autosaisie/autosaisie.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AutosaisieService } from './autosaisie.service';
import { CreateAutosaisieDto } from './dto/create-autosaisie.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { CreateAutosaisieMatriculeDto } from './dto/create-autosaisie-matricule.dto';

@Controller('autosaisie')
@UseGuards(JwtAuthGuard)
export class AutosaisieController {
  constructor(private readonly autosaisieService: AutosaisieService) {}

  /**
   * Créer une autosaisie à partir du badge
   * POST /autosaisie
   * Body: { "n_badget": "0503" }
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateAutosaisieDto) {
    return await this.autosaisieService.create(dto);
  }

  /**
   * Gestion des badges (Admin uniquement)
   */

  // Créer un badge
  @Post('badge')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createBadge(
    @Body('n_badget') n_badget: string,
    @Body('matricule', ParseIntPipe) matricule: number,
  ) {
    return await this.autosaisieService.createBadge(n_badget, matricule);
  }

  // Récupérer tous les badges
  @Get('badge')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findAllBadges() {
    return await this.autosaisieService.findAllBadges();
  }

  // Récupérer un badge par son numéro
  @Get('badge/:n_badget')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findBadgeByNumero(@Param('n_badget') n_badget: string) {
    return await this.autosaisieService.findBadgeByNumero(n_badget);
  }

  // Supprimer un badge
  @Delete('badge/:n_badget')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async removeBadge(@Param('n_badget') n_badget: string) {
    return await this.autosaisieService.removeBadge(n_badget);
  }

  @Post('matricule')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createByMatricule(@Body() dto: CreateAutosaisieMatriculeDto) {
    return await this.autosaisieService.createByMatricule(dto.matricule);
  }
}