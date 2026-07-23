// src/autosaisie/autosaisie.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutosaisieService } from './autosaisie.service';
import { AutosaisieController } from './autosaisie.controller';
import { Badge } from './entities/badge.entity';
import { SaisieRapport } from '../saisie-rapport/entities/saisie-rapport.entity';
import { AffectationModule } from '../affectation/affectation.module';
import { SaisieRapportModule } from '../saisie-rapport/saisie-rapport.module';
import { OuvrierModule } from '../ouvrier/ouvrier.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Badge, SaisieRapport]),
    AffectationModule,
    SaisieRapportModule,
    OuvrierModule,
  ],
  controllers: [AutosaisieController],
  providers: [AutosaisieService],
  exports: [AutosaisieService],
})
export class AutosaisieModule {}