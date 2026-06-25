import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointageService } from './pointage.service';
import { PointageController } from './pointage.controller';
import { Pointage } from './entities/pointage.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Badge } from 'src/autosaisie/entities/badge.entity';
import { Employee } from '../employee/entities/employee.entity';
import { StatutManuelModule } from '../statut-manuel/statut-manuel.module'; // ✅ NOUVEAU

@Module({
  imports: [
    TypeOrmModule.forFeature([Pointage, Ouvrier, Badge, Employee]),
    StatutManuelModule, // ✅ NOUVEAU
  ],
  controllers: [PointageController],
  providers: [PointageService],
  exports: [PointageService],
})
export class PointageModule {}