import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointageService } from './pointage.service';
import { PointageController } from './pointage.controller';
import { Pointage } from './entities/pointage.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { Badge } from 'src/autosaisie/entities/badge.entity';
import { Employee } from '../employee/entities/employee.entity';
import { StatutManuelModule } from '../statut-manuel/statut-manuel.module';
import { Affectation } from '../affectation/entities/affectation.entity'; // ✅ NOUVEAU
import { Maintenance } from '../secteurs/maintenance/maintenance.entity'; // ✅ NOUVEAU
import { Magasin } from '../secteurs/magasin/magasin.entity'; // ✅ NOUVEAU
import { Qualite } from '../secteurs/qualite/qualite.entity'; // ✅ NOUVEAU
import { Selection } from '../secteurs/selection/selection.entity'; // ✅ NOUVEAU
import { TeamProduction } from '../secteurs/team-production/team-production.entity'; // ✅ NOUVEAU

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pointage,
      Ouvrier,
      Badge,
      Employee,
      Affectation,
      Maintenance, // ✅ NOUVEAU
      Magasin, // ✅ NOUVEAU
      Qualite, // ✅ NOUVEAU
      Selection, // ✅ NOUVEAU
      TeamProduction, // ✅ NOUVEAU
    ]),
    StatutManuelModule,
  ],
  controllers: [PointageController],
  providers: [PointageService],
  exports: [PointageService],
})
export class PointageModule {}