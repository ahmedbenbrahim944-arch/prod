// src/statut/statut.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatutController } from './statut.controller';
import { StatutService } from './statut.service';
import { StatutOuvrier } from './entities/statut-ouvrier.entity';
import { Ouvrier } from '../ouvrier/entities/ouvrier.entity';
import { SaisieRapport } from '../saisie-rapport/entities/saisie-rapport.entity';
import { PlanningSelection } from '../planning-selection/entities/planning-selection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StatutOuvrier,
      Ouvrier,
      SaisieRapport,
      PlanningSelection  // 🆕 Ajout de PlanningSelection
    ]),
  ],
  controllers: [StatutController],
  providers: [StatutService],
  exports: [StatutService, TypeOrmModule]
})
export class StatutModule {}