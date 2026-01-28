// src/non-conf/non-conf.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NonConfController } from './non-conf.controller';
import { NonConfService } from './non-conf.service';
import { NonConformite } from './entities/non-conf.entity';
import { Planification } from '../semaine/entities/planification.entity';
import { SemaineModule } from '../semaine/semaine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NonConformite, Planification]),
    forwardRef(() => SemaineModule) // ✅ MODIFIÉ - Ajout de forwardRef pour éviter dépendance circulaire
  ],
  controllers: [NonConfController],
  providers: [NonConfService],
  exports: [NonConfService]
})
export class NonConfModule {}