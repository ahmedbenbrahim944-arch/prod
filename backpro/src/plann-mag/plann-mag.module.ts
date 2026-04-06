// src/plann-mag/plann-mag.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlannMagController } from './plann-mag.controller';
import { PlannMagService } from './plann-mag.service';
import { MatierePremiere } from './entities/matiere-premiere.entity';
import { DocumentServi } from './entities/document-servi.entity';
import { Planification } from '../semaine/entities/planification.entity';
import { Semaine } from '../semaine/entities/semaine.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatierePremiere,
      DocumentServi,   // ← nouvelle entité
      Planification,
      Semaine,
    ]),
  ],
  controllers: [PlannMagController],
  providers: [PlannMagService],
  exports: [PlannMagService],
}) 
export class PlannMagModule {}