// src/plaquettes/plaquettes.controller.ts
import {
  Controller, Get, Post, Body, Param, Delete,
  Patch, Query, UseGuards, UsePipes, ValidationPipe,
  ParseIntPipe, Req,
} from '@nestjs/common';
import { PlaquettesService } from './plaquettes.service';
import { CreatePlaquetteDto } from './dto/create-plaquette.dto';
import { UpdatePlaquetteDto } from './dto/update-plaquette.dto';
import { FilterPlaquetteDto } from './dto/filter-plaquette.dto';
import { GetStatsDto } from './dto/get-stats.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('plaquettes')
export class PlaquettesController {
  constructor(private readonly plaquettesService: PlaquettesService) {}

  // GET /plaquettes/matricules
  @Get('matricules')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async getMatriculesMachines() {
    return { matricules: await this.plaquettesService.getMatriculesMachines() };
  }

  // GET /plaquettes/types
  @Get('types')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async getTypesPlaquettes() {
    return { types: await this.plaquettesService.getTypesPlaquettes() };
  }

  // POST /plaquettes/stats
  // Body: { dateDebut: 'YYYY-MM-DD', dateFin: 'YYYY-MM-DD' }
  @Post('stats')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getStats(@Body() dto: GetStatsDto) {
    return this.plaquettesService.getStatsByDateRange(dto.dateDebut, dto.dateFin);
  }

  // POST /plaquettes
  @Post()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreatePlaquetteDto, @Req() req) {
    const plaquette = await this.plaquettesService.create(dto, req.user);
    return { message: 'Plaquette créée avec succès', plaquette };
  }

  // GET /plaquettes
  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async findAll(@Query() filterDto: FilterPlaquetteDto) {
    return this.plaquettesService.findAll(filterDto);
  }

  // GET /plaquettes/:id
  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plaquettesService.findOne(id);
  }

  // PATCH /plaquettes/:id
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlaquetteDto) {
    const plaquette = await this.plaquettesService.update(id, dto);
    return { message: 'Plaquette mise à jour avec succès', plaquette };
  }

  // DELETE /plaquettes/:id
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.plaquettesService.remove(id);
  }
}