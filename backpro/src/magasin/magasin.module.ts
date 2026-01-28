import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MagasinController } from './magasin.controller';
import { MagasinService } from './magasin.service';
import { Planification } from '../semaine/entities/planification.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
// Import optionnel si vous créez l'entité MagasinOperation
// import { MagasinOperation } from './entities/magasin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Planification, Semaine])
    // Optionnel : ajouter MagasinOperation si créé
    // TypeOrmModule.forFeature([Planification, Semaine, MagasinOperation])
  ],
  controllers: [MagasinController],
  providers: [MagasinService],
  exports: [MagasinService]
})
export class MagasinModule {}