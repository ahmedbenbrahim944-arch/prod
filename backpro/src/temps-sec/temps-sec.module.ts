// src/temps-sec/temps-sec.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TempsSecService } from './temps-sec.service';
import { TempsSecController } from './temps-sec.controller';
import { TempsSec } from './entities/temps-sec.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TempsSec])],
  controllers: [TempsSecController],
  providers: [TempsSecService],
  exports: [TempsSecService, TypeOrmModule] // BIEN EXPORTER TypeOrmModule
})
export class TempsSecModule {}