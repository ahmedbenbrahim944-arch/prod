// src/phase/phase.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhaseService } from './phase.service';
import { PhaseController } from './phase.controller';
import { Phase } from './entities/phase.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Phase])],
  controllers: [PhaseController],
  providers: [PhaseService],
  exports: [PhaseService],
})
export class PhaseModule {}