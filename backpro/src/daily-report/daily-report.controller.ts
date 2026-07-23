// src/daily-report/daily-report.controller.ts
import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { DailyReportService } from './daily-report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('daily-report')
export class DailyReportController {
  constructor(private readonly dailyReportService: DailyReportService) {}

  // ============================================================
  // DÉCLENCHEMENT MANUEL (Admin uniquement)
  // POST /daily-report/send-m1
  // Body optionnel: { date: "2025-05-14" }
  // ============================================================
  @Post('send-m1')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  async triggerM1Report(@Query('date') dateStr?: string) {
    let targetDate: Date | undefined;

    if (dateStr) {
      targetDate = new Date(dateStr);
      if (isNaN(targetDate.getTime())) {
        throw new BadRequestException(
          'Format de date invalide. Utilisez YYYY-MM-DD (ex: 2025-05-14)',
        );
      }
    }

    const result = await this.dailyReportService.sendM1Report(targetDate);

    return {
      ...result,
      timestamp: new Date().toISOString(),
      triggeredManually: true,
      targetDate: targetDate?.toLocaleDateString('fr-FR') || 'aujourd\'hui',
    };
  }

  // ============================================================
  // TEST CONNEXION SMTP
  // GET /daily-report/test-smtp
  // ============================================================
  @Get('test-smtp')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async testSmtp() {
    const isConnected = await this.dailyReportService.testSmtpConnection();

    return {
      smtp: isConnected ? '✅ Connexion OK' : '❌ Connexion échouée',
      connected: isConnected,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // STATUS DU CRON
  // GET /daily-report/status
  // ============================================================
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus() {
    return {
      service: 'DailyReportService',
      cronSchedule: 'Tous les jours (lun-sam) à 09h30',
      cronExpression: '0 30 9 * * 1-6',
      timezone: 'Africa/Tunis',
      reportType: 'M1 — Matières Premières non-conformes',
      status: '✅ Actif',
      timestamp: new Date().toISOString(),
    };
  }
}