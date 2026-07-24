import { Body, Controller, Get, Post } from '@nestjs/common';
import { TeamProductionService } from './team-production.service';
import { CreateTeamProductionDto } from './dto/create-team-production.dto';

@Controller('team-production')
export class TeamProductionController {
  constructor(private readonly teamProductionService: TeamProductionService) {}

  @Post()
  create(@Body() dto: CreateTeamProductionDto) {
    return this.teamProductionService.create(dto);
  }

  @Get()
  findAll() {
    return this.teamProductionService.findAll();
  }
}