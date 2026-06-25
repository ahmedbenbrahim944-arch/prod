import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatutManuel } from './entites/statut-manuel.entity';
import { StatutManuelService } from './statut-manuel.service';
import { StatutManuelController } from './statut-manuel.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StatutManuel])],
  controllers: [StatutManuelController],
  providers: [StatutManuelService],
  exports: [StatutManuelService], // ✅ pour que PointageModule puisse l'utiliser
})
export class StatutManuelModule {}