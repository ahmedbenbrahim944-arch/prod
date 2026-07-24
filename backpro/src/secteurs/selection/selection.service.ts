import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Selection } from './selection.entity';
import { CreateSelectionDto } from './dto/create-selection.dto';

@Injectable()
export class SelectionService {
  constructor(
    @InjectRepository(Selection)
    private readonly selectionRepo: Repository<Selection>,
  ) {}

  create(dto: CreateSelectionDto): Promise<Selection> {
    const nouveau = this.selectionRepo.create(dto);
    return this.selectionRepo.save(nouveau);
  }

  findAll(): Promise<Selection[]> {
    return this.selectionRepo.find();
  }
}