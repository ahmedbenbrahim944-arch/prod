// src/planning-selection/planning-selection.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningSelectionService } from './planning-selection.service';
import { PlanningSelectionController } from './planning-selection.controller';
import { PlanningSelection } from './entities/planning-selection.entity';
import { Selection } from 'src/secteurs/selection/selection.entity';
import { Product } from '../product/entities/product.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { MatierePremier } from '../matiere-premier/entities/matiere-premier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanningSelection, 
      Selection, 
      Product,
      Semaine,
      MatierePremier
    ])
  ],
  controllers: [PlanningSelectionController],
  providers: [PlanningSelectionService],
  exports: [PlanningSelectionService]
})
export class PlanningSelectionModule {}