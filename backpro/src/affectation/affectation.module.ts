// src/affectation/affectation.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffectationService } from './affectation.service';
import { AffectationController } from './affectation.controller';
import { Affectation } from './entities/affectation.entity';
import { AffectationPhase } from './entities/affectation-phase.entity';
import { OuvrierModule } from '../ouvrier/ouvrier.module';
import { PhaseModule } from '../phase/phase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Affectation, AffectationPhase]),
    OuvrierModule,
    PhaseModule,
  ],
  controllers: [AffectationController],
  providers: [AffectationService],
  exports: [AffectationService],
})
export class AffectationModule {}