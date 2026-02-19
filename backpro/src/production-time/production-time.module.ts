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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionSession, 
      PauseSession, 
      Product, 
      User,
      TempsSec,        // ✅ Ajout pour calcul quantité
      MatierePremier,  // ✅ Ajout pour références M1
      Phase            // ✅ Ajout pour références M4
    ])
  ],
  controllers: [ProductionTimeController],
  providers: [ProductionTimeService],
  exports: [ProductionTimeService]
})
export class ProductionTimeModule {}