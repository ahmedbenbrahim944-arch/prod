// src/ouvrier/ouvrier.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OuvrierService } from './ouvrier.service';
import { OuvrierController } from './ouvrier.controller';
import { Ouvrier } from './entities/ouvrier.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ouvrier])],
  controllers: [OuvrierController],
  providers: [OuvrierService],
  exports: [OuvrierService],
})
export class OuvrierModule {}