// src/plaquettes/plaquettes.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaquettesController } from './plaquettes.controller';
import { PlaquettesService } from './plaquettes.service';
import { Plaquette } from './entities/plaquette.entity';
import { MatriculeMachine } from './entities/matricule-machine.entity';
import { TypePlaquette } from './entities/type-plaquette.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { Product } from '../product/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plaquette, MatriculeMachine, TypePlaquette, Semaine, Product]),
  ],
  controllers: [PlaquettesController],
  providers: [PlaquettesService],
  exports: [PlaquettesService],
})
export class PlaquettesModule {}