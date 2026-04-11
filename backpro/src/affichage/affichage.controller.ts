// src/affichage/affichage.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
    Get,
} from '@nestjs/common';
import { AffichageService } from './affichage.service';
import { GetAffichageDto } from './dto/get-affichage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('affichage')
@UseGuards(JwtAuthGuard)
export class AffichageController {
  constructor(private readonly affichageService: AffichageService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async getAffichage(@Body() dto: GetAffichageDto) {
    return this.affichageService.getAffichage(dto);
  }
  @Get('lignes')
async getLignes() {
  return this.affichageService.getLignes();
}
}