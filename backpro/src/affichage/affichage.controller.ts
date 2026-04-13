// src/affichage/affichage.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Get,
} from '@nestjs/common';
import { AffichageService } from './affichage.service';
import { GetAffichageDto } from './dto/get-affichage.dto';
import { GetOverviewDto } from './dto/get-overview.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('affichage')
@UseGuards(JwtAuthGuard)
export class AffichageController {
  constructor(private readonly affichageService: AffichageService) {}

  /**
   * POST /affichage
   * Vue détaillée d'une ligne pour une date donnée
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getAffichage(@Body() dto: GetAffichageDto) {
    return this.affichageService.getAffichage(dto);
  }

  /**
   * POST /affichage/overview
   * Vue globale : toutes les lignes planifiées pour une date
   */
  @Post('overview')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getOverview(@Body() dto: GetOverviewDto) {
    return this.affichageService.getOverview(dto);
  }

  /**
   * GET /affichage/lignes
   * Liste de toutes les lignes disponibles
   */
  @Get('lignes')
  async getLignes() {
    return this.affichageService.getLignes();
  }
}