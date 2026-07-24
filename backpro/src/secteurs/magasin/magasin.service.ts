import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Magasin } from './magasin.entity';
import { CreateMagasinDto } from './dto/create-magasin.dto';

@Injectable()
export class MagasinService {
  constructor(
    @InjectRepository(Magasin)
    private readonly magasinRepo: Repository<Magasin>,
  ) {}

  create(dto: CreateMagasinDto): Promise<Magasin> {
    const nouveau = this.magasinRepo.create(dto);
    return this.magasinRepo.save(nouveau);
  }

  findAll(): Promise<Magasin[]> {
    return this.magasinRepo.find();
  }
}