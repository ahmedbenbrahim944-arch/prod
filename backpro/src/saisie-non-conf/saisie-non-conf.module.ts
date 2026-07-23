// src/saisie-non-conf/saisie-non-conf.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaisieNonConfService } from './saisie-non-conf.service';
import { SaisieNonConfController } from './saisie-non-conf.controller';
import { SaisieNonConf } from './entities/saisie-non-conf.entity';
import { MatierePremier } from '../matiere-premier/entities/matiere-premier.entity';
import { Product } from '../product/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaisieNonConf, MatierePremier, Product])
  ],
  controllers: [SaisieNonConfController],
  providers: [SaisieNonConfService],
  exports: [SaisieNonConfService]
})
export class SaisieNonConfModule {}