// src/daily-report/daily-report.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { DailyReportService } from './daily-report.service';
import { DailyReportController } from './daily-report.controller';
import { EmailService } from '../email/email.service';
import { NonConformite } from '../non-conf/entities/non-conf.entity';
import { Planification } from '../semaine/entities/planification.entity';

@Module({
  imports: [
    // Entités TypeORM nécessaires
    TypeOrmModule.forFeature([NonConformite, Planification]),
    // Scheduler (cron)
    ScheduleModule.forRoot(),
    // Variables d'environnement
    ConfigModule,
  ],
  controllers: [DailyReportController],
  providers: [DailyReportService, EmailService],
  exports: [DailyReportService],
})
export class DailyReportModule {}

