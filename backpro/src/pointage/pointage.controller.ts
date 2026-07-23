import { Controller, Post, Get, Body, UseGuards, Query } from '@nestjs/common';
import { PointageService } from './pointage.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('pointage')
export class PointageController {
  constructor(private readonly pointageService: PointageService) {}

  @Post('import')
  async import(@Body() body: any[]) {
    return this.pointageService.importPointages(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('today')
  async getToday() {
    return this.pointageService.getPresentsAujourdhui();
  }

  @UseGuards(JwtAuthGuard)
  @Get('periode')
  async getPeriode(@Query('debut') debut: string, @Query('fin') fin: string) {
    return this.pointageService.getPresenceParPeriode(debut, fin);
  }

  // ✅ Endpoints basés sur Employee (4 services)
  @UseGuards(JwtAuthGuard)
  @Get('employes/today')
  async getTodayEmployees() {
    return this.pointageService.getPresentsAujourdhuiEmployees();
  }

  @UseGuards(JwtAuthGuard)
  @Get('employes/periode')
  async getPeriodeEmployees(
    @Query('debut') debut: string,
    @Query('fin') fin: string,
  ) {
    return this.pointageService.getPresenceParPeriodeEmployees(debut, fin);
  }

  // ✅ NOUVEAU — Récap jours Présent/Absent/Congé (Ouvriers + Employees)
  @UseGuards(JwtAuthGuard)
  @Get('recap-periode')
  async getRecapPeriode(
    @Query('debut') debut: string,
    @Query('fin') fin: string,
  ) {
    return this.pointageService.getRecapJoursPeriode(debut, fin);
  }
  @UseGuards(JwtAuthGuard)
  @Get('poste/today')
  async getRecapPosteToday() {
    return this.pointageService.getRecapPosteAujourdhui();
  }

  // ✅ NOUVEAU — Récap présents/absents par ligne + poste (jour/nuit), sur une période
  @UseGuards(JwtAuthGuard)
  @Get('poste/periode')
  async getRecapPostePeriode(
    @Query('debut') debut: string,
    @Query('fin') fin: string,
  ) {
    return this.pointageService.getRecapPostePeriode(debut, fin);
  }
  @UseGuards(JwtAuthGuard)
@Get('poste/today/detaille')
async getRecapPosteTodayDetaille() {
  return this.pointageService.getRecapPosteAujourdhuiDetaille();
}
@UseGuards(JwtAuthGuard)
  @Get('stats-dashboard')
  async getStatsDashboard(
    @Query('debut') debut: string,
    @Query('fin') fin: string,
    @Query('service') service?: string,
  ) {
    return this.pointageService.getStatsDashboard(debut, fin, service);
  }
  @UseGuards(JwtAuthGuard)
  @Get('fiche-personne')
  async getFichePersonne(
    @Query('matricule') matricule: string,
    @Query('debut') debut: string,
    @Query('fin') fin: string,
  ) {
    return this.pointageService.getFichePersonne(matricule, debut, fin);
  }
}