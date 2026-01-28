// src/statut/statut.controller.ts
import { Controller, Post, Body, Get, Query, UseGuards, UsePipes, ValidationPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { StatutService } from './statut.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateStatutDto } from './dto/update-statut.dto';
import { GetStatutByDateDto } from './dto/get-statut-by-date.dto';

@Controller('statut')
export class StatutController {
  constructor(private readonly statutService: StatutService) {}

  /**
   * Mettre à jour le statut d'un ouvrier pour une date
   * POST /statut
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @HttpCode(HttpStatus.OK)
  async updateStatut(@Body() updateStatutDto: UpdateStatutDto) {
    return this.statutService.updateStatut(updateStatutDto);
  }

  /**
   * Obtenir tous les statuts pour une date donnée
   * GET /statut/par-date?date=2026-01-05
   */
  @Get('par-date')
  @UseGuards(JwtAuthGuard)
  async getStatutsByDate(@Query() getStatutByDateDto: GetStatutByDateDto) {
    return this.statutService.getStatutsByDate(getStatutByDateDto);
  }

  /**
   * Obtenir les ouvriers non-saisis avec leurs statuts
   * GET /statut/ouvriers-non-saisis?date=2026-01-05
   */
  @Get('ouvriers-non-saisis')
  @UseGuards(JwtAuthGuard)
  async getOuvriersNonSaisis(@Query('date') date: string) {
    return this.statutService.getOuvriersNonSaisisParDate(date);
  }
}