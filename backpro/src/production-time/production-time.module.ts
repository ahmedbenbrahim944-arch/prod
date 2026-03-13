// production-time.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionTimeService } from './production-time.service';
import { ProductionTimeController } from './production-time.controller';
import { ProductionSession } from './entities/production-session.entity';
import { PauseSession } from './entities/pause-session.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { TempsSec } from '../temps-sec/entities/temps-sec.entity';
import { MatierePremier } from '../matiere-premier/entities/matiere-premier.entity';
import { Phase } from '../phase/entities/phase.entity';
import { Planification } from '../semaine/entities/planification.entity'; // ✅ NOUVEAU
import { Semaine } from '../semaine/entities/semaine.entity'; // ✅ NOUVEAU

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionSession, 
      PauseSession, 
      Product, 
      User,
      TempsSec,
      MatierePremier,
      Phase,
      Planification, // ✅ NOUVEAU : pour récupérer les refs avec OF non null
      Semaine,       // ✅ NOUVEAU : pour trouver la semaine courante par date
    ])
  ],
  controllers: [ProductionTimeController],
  providers: [ProductionTimeService],
  exports: [ProductionTimeService]
})
export class ProductionTimeModule {}