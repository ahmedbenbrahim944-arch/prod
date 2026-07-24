import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamProduction } from './team-production.entity';
import { CreateTeamProductionDto } from './dto/create-team-production.dto';

@Injectable()
export class TeamProductionService {
  constructor(
    @InjectRepository(TeamProduction)
    private readonly teamProductionRepo: Repository<TeamProduction>,
  ) {}

  create(dto: CreateTeamProductionDto): Promise<TeamProduction> {
    const nouveau = this.teamProductionRepo.create(dto);
    return this.teamProductionRepo.save(nouveau);
  }

  findAll(): Promise<TeamProduction[]> {
    return this.teamProductionRepo.find();
  }
}