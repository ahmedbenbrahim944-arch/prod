import { Body, Controller, Get, Post } from '@nestjs/common';
import { QualiteService } from './qualite.service';
import { CreateQualiteDto } from './dto/create-qualite.dto';

@Controller('qualite')
export class QualiteController {
  constructor(private readonly qualiteService: QualiteService) {}

  @Post()
  create(@Body() dto: CreateQualiteDto) {
    return this.qualiteService.create(dto);
  }

  @Get()
  findAll() {
    return this.qualiteService.findAll();
  }
}