import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MagasinController } from './magasin.controller';
import { MagasinService } from './magasin.service';
import { Planification } from '../semaine/entities/planification.entity';
import { Semaine } from '../semaine/entities/semaine.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([Planification, Semaine])
   
  ],
  controllers: [MagasinController],
  providers: [MagasinService],
  exports: [MagasinService]
})
export class MagasinModule {}