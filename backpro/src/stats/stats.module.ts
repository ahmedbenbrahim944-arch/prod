// src/stats/stats.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { Planification } from '../semaine/entities/planification.entity';
import { NonConformite } from '../non-conf/entities/non-conf.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { SaisieRapport } from '../saisie-rapport/entities/saisie-rapport.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { StatutOuvrier } from '../statut/entities/statut-ouvrier.entity'; // ✅ IMPORT
import { PlanningSelection } from 'src/planning-selection/entities/planning-selection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Planification, 
      NonConformite, 
      Semaine,
      SaisieRapport,
      Ouvrier,
      StatutOuvrier ,
      PlanningSelection// ✅ AJOUTER ICI
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService]
})
export class StatsModule {}
