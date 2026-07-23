// src/semaine/semaine.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemaineController } from './semaine.controller';
import { SemaineService } from './semaine.service';
import { Semaine } from './entities/semaine.entity';
import { Planification } from './entities/planification.entity';
import { Product } from '../product/entities/product.entity';
import { TempsSec } from '../temps-sec/entities/temps-sec.entity';
import { NonConfModule } from '../non-conf/non-conf.module'; // ✅ AJOUTÉ

@Module({
  imports: [
    TypeOrmModule.forFeature([Semaine, Planification, Product, TempsSec]),
    forwardRef(() => NonConfModule) // ✅ AJOUTÉ - Import avec forwardRef pour éviter dépendance circulaire
  ],
  controllers: [SemaineController],
  providers: [SemaineService],
  exports: [SemaineService, TypeOrmModule]
})
export class SemaineModule {}