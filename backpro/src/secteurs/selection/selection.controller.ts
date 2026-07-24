import { Body, Controller, Get, Post } from '@nestjs/common';
import { SelectionService } from './selection.service';
import { CreateSelectionDto } from './dto/create-selection.dto';

@Controller('selection')
export class SelectionController {
  constructor(private readonly selectionService: SelectionService) {}

  @Post()
  create(@Body() dto: CreateSelectionDto) {
    return this.selectionService.create(dto);
  }

  @Get()
  findAll() {
    return this.selectionService.findAll();
  }
}