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
}