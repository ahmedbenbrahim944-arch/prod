// src/matiere-premier/matiere-premier.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatierePremierService } from './matiere-premier.service';
import { MatierePremierController } from './matiere-premier.controller';
import { MatierePremier } from './entities/matiere-premier.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MatierePremier])],
  controllers: [MatierePremierController],
  providers: [MatierePremierService],
  exports: [MatierePremierService],
})
export class MatierePremierModule {}