// src/affectation/affectation.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AffectationService } from './affectation.service';
import { CreateAffectationDto } from './dto/create-affectation.dto';
import { UpdateAffectationDto } from './dto/update-affectation.dto';
import { AddPhaseDto } from './dto/add-phase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('affectation')
@UseGuards(JwtAuthGuard)
export class AffectationController {
  constructor(private readonly affectationService: AffectationService) {}

  // ─── Créer une affectation (avec phases + heures) ─────────────────────────
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateAffectationDto) {
    const data = await this.affectationService.create(dto);
    return { message: 'Affectation créée avec succès', data };
  }

  // ─── Lire toutes les affectations ─────────────────────────────────────────
  @Get()
  async findAll() {
    const data = await this.affectationService.findAll();
    return { total: data.length, data };
  }

  // ─── Lire l'affectation d'un ouvrier ──────────────────────────────────────
  @Get('ouvrier/:matricule')
  async findByMatricule(@Param('matricule', ParseIntPipe) matricule: number) {
    return await this.affectationService.findByMatricule(matricule);
  }

  // ─── Lire les affectations d'une ligne ────────────────────────────────────
  @Get('ligne/:ligne')
  async findByLigne(@Param('ligne') ligne: string) {
    const data = await this.affectationService.findByLigne(ligne);
    return { ligne, total: data.length, data };
  }

  // ─── Modifier l'affectation (ligne et/ou remplacer toutes les phases) ─────
  @Patch(':matricule')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('matricule', ParseIntPipe) matricule: number,
    @Body() dto: UpdateAffectationDto,
  ) {
    const data = await this.affectationService.update(matricule, dto);
    return { message: 'Affectation modifiée avec succès', data };
  }

  // ─── Ajouter une phase à une affectation existante ────────────────────────
  @Post(':matricule/phases')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async addPhase(
    @Param('matricule', ParseIntPipe) matricule: number,
    @Body() dto: AddPhaseDto,
  ) {
    const data = await this.affectationService.addPhase(matricule, dto);
    return { message: 'Phase ajoutée avec succès', data };
  }

  // ─── Modifier les heures d'une phase précise ──────────────────────────────
  @Patch(':matricule/phases/:phase')
  async updatePhaseHeures(
    @Param('matricule', ParseIntPipe) matricule: number,
    @Param('phase') phase: string,
    @Body('heures') heures: number,
  ) {
    const data = await this.affectationService.updatePhaseHeures(matricule, phase, heures);
    return { message: 'Heures mises à jour', data };
  }

  // ─── Supprimer une phase ──────────────────────────────────────────────────
  @Delete(':matricule/phases/:phase')
  async removePhase(
    @Param('matricule', ParseIntPipe) matricule: number,
    @Param('phase') phase: string,
  ) {
    const data = await this.affectationService.removePhase(matricule, phase);
    return { message: 'Phase supprimée', data };
  }

  // ─── Supprimer toute l'affectation ───────────────────────────────────────
  @Delete(':matricule')
  async remove(@Param('matricule', ParseIntPipe) matricule: number) {
    await this.affectationService.remove(matricule);
    return { message: `Affectation de l'ouvrier ${matricule} supprimée` };
  }

  @Post(':matricule/nommer-capitaine')
  async nommerCapitaine(@Param('matricule', ParseIntPipe) matricule: number) {
    return await this.affectationService.nommerCapitaine(matricule);
  }

  // ─── Retirer le statut capitaine ──────────────────────────────────────────
  @Delete(':matricule/retirer-capitaine')
  async retirerCapitaine(@Param('matricule', ParseIntPipe) matricule: number) {
    return await this.affectationService.retirerCapitaine(matricule);
  }

  // ─── Lire tous les capitaines ─────────────────────────────────────────────
  @Get('capitaines')
  async findAllCapitaines() {
    const data = await this.affectationService.findAllCapitaines();
    return { total: data.length, data };
  }

  // ─── Lire le capitaine d'une ligne ────────────────────────────────────────
  @Get('ligne/:ligne/capitaine')
  async findCapitaineByLigne(@Param('ligne') ligne: string) {
    return await this.affectationService.findCapitaineByLigne(ligne);
  }
}
