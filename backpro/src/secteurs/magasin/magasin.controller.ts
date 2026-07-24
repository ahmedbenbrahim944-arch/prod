import { Body, Controller, Get, Post } from '@nestjs/common';
import { MagasinService } from './magasin.service';
import { CreateMagasinDto } from './dto/create-magasin.dto';

@Controller('magasin')
export class MagasinController {
  constructor(private readonly magasinService: MagasinService) {}

  @Post()
  create(@Body() dto: CreateMagasinDto) {
    return this.magasinService.create(dto);
  }

  @Get()
  findAll() {
    return this.magasinService.findAll();
  }
}