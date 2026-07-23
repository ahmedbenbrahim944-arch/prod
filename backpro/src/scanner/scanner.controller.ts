// src/scanner/scanner.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ScannerService } from './scanner.service';
import { CreateScanDto } from './dto/create-scan.dto';

@Controller('scanner')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  // POST /scanner
  // Scanner un nouveau ticket
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createScan(@Body() dto: CreateScanDto) {
    return this.scannerService.createScan(dto);
  }

  // GET /scanner
  // Tous les scans
  @Get()
  findAll() {
    return this.scannerService.findAll();
  }

  // GET /scanner/semaine/:semaineId
  // Tous les scans d'une semaine donnée
  @Get('semaine/:semaineId')
  findBySemaine(@Param('semaineId', ParseIntPipe) semaineId: number) {
    return this.scannerService.findBySemaine(semaineId);
  }

  // GET /scanner/code-produits
  // Liste tous les codes produit disponibles
  @Get('code-produits')
  findAllCodeProduit() {
    return this.scannerService.findAllCodeProduit();
  }

  // GET /scanner/fullnumber/:fullnumber
  // Chercher un scan par fullnumber
  @Get('fullnumber/:fullnumber')
  findByFullnumber(@Param('fullnumber') fullnumber: string) {
    return this.scannerService.findByFullnumber(fullnumber);
  }

  // GET /scanner/:id
  // Un scan par id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.scannerService.findOne(id);
  }

  // DELETE /scanner/:id
  // Supprimer un scan
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.scannerService.remove(id);
  }
}