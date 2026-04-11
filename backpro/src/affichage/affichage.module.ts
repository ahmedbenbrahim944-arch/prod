// src/affichage/affichage.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffichageController } from './affichage.controller';
import { AffichageService } from './affichage.service';

// Entités nécessaires
import { Planification } from '../semaine/entities/planification.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { Affectation } from '../affectation/entities/affectation.entity';
import { AffectationPhase } from '../affectation/entities/affectation-phase.entity';
import { ProductionRecord } from '../production/entities/production-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Planification,
      Semaine,
      Affectation,
      AffectationPhase,
      ProductionRecord,
    ]),
  ],
  controllers: [AffichageController],
  providers: [AffichageService],
  exports: [AffichageService],
})
export class AffichageModule {}