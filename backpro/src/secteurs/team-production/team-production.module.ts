import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamProduction } from './team-production.entity';
import { TeamProductionService } from './team-production.service';
import { TeamProductionController } from './team-production.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TeamProduction])],
  controllers: [TeamProductionController],
  providers: [TeamProductionService],
})
export class TeamProductionModule {}