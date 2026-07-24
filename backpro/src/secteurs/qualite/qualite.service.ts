import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Qualite } from './qualite.entity';
import { CreateQualiteDto } from './dto/create-qualite.dto';

@Injectable()
export class QualiteService {
  constructor(
    @InjectRepository(Qualite)
    private readonly qualiteRepo: Repository<Qualite>,
  ) {}

  create(dto: CreateQualiteDto): Promise<Qualite> {
    const nouveau = this.qualiteRepo.create(dto);
    return this.qualiteRepo.save(nouveau);
  }

  findAll(): Promise<Qualite[]> {
    return this.qualiteRepo.find();
  }
}