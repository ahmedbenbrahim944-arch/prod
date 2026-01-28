// src/planning-selection/planning-selection.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe
} from '@nestjs/common';
import { PlanningSelectionService } from './planning-selection.service';
import { CreatePlanningSelectionDto } from './dto/create-planning-selection.dto';
import { UpdatePlanningSelectionDto } from './dto/update-planning-selection.dto';

@Controller('planning-selection')
export class PlanningSelectionController {
  constructor(private readonly planningService: PlanningSelectionService) {}

  /**
   * Créer un nouveau planning
   * POST /planning-selection
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreatePlanningSelectionDto) {
    return await this.planningService.create(createDto);
  }

  /**
   * Récupérer tous les plannings
   * GET /planning-selection
   */
  @Get()
  async findAll() {
    return await this.planningService.findAll();
  }

  /**
   * 🆕 Récupérer les plannings incomplets (en attente)
   * GET /planning-selection/incomplets
   * ⚠️ IMPORTANT: Cette route DOIT être AVANT @Get(':id')
   */
  @Get('incomplets')
  async findIncomplets() {
    return await this.planningService.findIncomplets();
  }

  /**
   * Récupérer un planning par ID
   * GET /planning-selection/:id
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.planningService.findOne(id);
  }

  /**
   * Récupérer les plannings par date
   * GET /planning-selection/date/:date
   */
  @Get('date/:date')
  async findByDate(@Param('date') date: string) {
    return await this.planningService.findByDate(date);
  }

  /**
   * Récupérer les plannings par matricule
   * GET /planning-selection/matricule/:matricule
   */
  @Get('matricule/:matricule')
  async findByMatricule(@Param('matricule', ParseIntPipe) matricule: number) {
    return await this.planningService.findByMatricule(matricule);
  }

  /**
   * Récupérer les plannings par date et matricule
   * GET /planning-selection/search/by-date-matricule
   */
  @Get('search/by-date-matricule')
  async findByDateAndMatricule(
    @Query('date') date: string,
    @Query('matricule', ParseIntPipe) matricule: number
  ) {
    return await this.planningService.findByDateAndMatricule(date, matricule);
  }

  /**
   * Récupérer les plannings par période
   * GET /planning-selection/search/by-period
   */
  @Get('search/by-period')
  async findByPeriod(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return await this.planningService.findByPeriod(startDate, endDate);
  }

  /**
   * Récupérer les plannings par semaine
   * GET /planning-selection/semaine/:semaine
   */
  @Get('semaine/:semaine')
  async findBySemaine(@Param('semaine', ParseIntPipe) semaine: number) {
    return await this.planningService.findBySemaine(semaine);
  }

  /**
   * Récupérer les plannings par année et semaine
   * GET /planning-selection/semaine/:annee/:semaine
   */
  @Get('semaine/:annee/:semaine')
  async findByAnneeSemaine(
    @Param('annee', ParseIntPipe) annee: number,
    @Param('semaine', ParseIntPipe) semaine: number
  ) {
    return await this.planningService.findByAnneeSemaine(annee, semaine);
  }

  /**
   * Récupérer les statistiques par ouvrier
   * GET /planning-selection/stats/ouvrier/:matricule
   */
  @Get('stats/ouvrier/:matricule')
  async getStatsByOuvrier(@Param('matricule', ParseIntPipe) matricule: number) {
    return await this.planningService.getStatsByOuvrier(matricule);
  }

  /**
   * Récupérer les statistiques par date
   * GET /planning-selection/stats/date/:date
   */
  @Get('stats/date/:date')
  async getStatsByDate(@Param('date') date: string) {
    return await this.planningService.getStatsByDate(date);
  }

  /**
   * Récupérer les statistiques par semaine
   * GET /planning-selection/stats/semaine/:semaine
   */
  @Get('stats/semaine/:semaine')
  async getStatsBySemaine(@Param('semaine', ParseIntPipe) semaine: number) {
    return await this.planningService.getStatsBySemaine(semaine);
  }

  /**
   * Récupérer les statistiques par période
   * GET /planning-selection/stats/period
   */
  @Get('stats/period')
  async getStatsByPeriod(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return await this.planningService.getStatsByPeriod(startDate, endDate);
  }

  /**
   * Mettre à jour un planning par ID
   * PATCH /planning-selection/:id
   */
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdatePlanningSelectionDto
  ) {
    return await this.planningService.update(id, updateDto);
  }

  /**
   * Mettre à jour un planning par matricule, référence et date
   * PATCH /planning-selection/update/by-info
   */
  @Patch('update/by-info')
  async updateByInfo(
    @Query('matricule', ParseIntPipe) matricule: number,
    @Query('reference') reference: string,
    @Query('date') date: string,
    @Body() updateDto: UpdatePlanningSelectionDto
  ) {
    return await this.planningService.updateByMatriculeReferenceDate(
      matricule, 
      reference, 
      date, 
      updateDto
    );
  }

  /**
   * Supprimer un planning
   * DELETE /planning-selection/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.planningService.remove(id);
  }
}