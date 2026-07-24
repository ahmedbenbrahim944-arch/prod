import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Maintenance } from './maintenance.entity';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(Maintenance)
    private readonly maintenanceRepo: Repository<Maintenance>,
  ) {}

  create(dto: CreateMaintenanceDto): Promise<Maintenance> {
    const nouveau = this.maintenanceRepo.create(dto);
    return this.maintenanceRepo.save(nouveau);
  }

  findAll(): Promise<Maintenance[]> {
    return this.maintenanceRepo.find();
  }
}