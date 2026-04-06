// src/plann-mag/plann-mag.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Request,
} from '@nestjs/common';
import { PlannMagService }             from './plann-mag.service';
import { GetPlannMagDto }              from './dto/get-plann-mag.dto';
import { SearchPlannMagDto }           from './dto/search-plann-mag.dto';
import { ScanDocumentDto }             from './dto/scan-document.dto';
import { GetOfsByDateDto }             from './dto/get-ofs-by-date.dto';
import { SearchByDateDto }             from './dto/search-by-date.dto';
import { CreateMatierePremiereDto }    from './dto/create-matiere-premiere.dto';
import { UpdateMatierePremiereDto }    from './dto/update-matiere-premiere.dto';
import { SearchMatierePremiereDto }    from './dto/search-matiere-premiere.dto';
import { JwtAuthGuard }                from '../auth/guards/jwt-auth.guard';

@Controller('plann-mag')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PlannMagController {
  constructor(private readonly plannMagService: PlannMagService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD ─── MATIÈRE PREMIÈRE
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /plann-mag/matieres — liste complète, triée ligne → ref → refMp */
  @Get('matieres')
  async getAllMatieres() {
    return this.plannMagService.getAllMatieresPremières();
  }

  /** POST /plann-mag/matieres/search — recherche multicritères (tous filtres optionnels) */
  @Post('matieres/search')
  async searchMatieres(@Body() dto: SearchMatierePremiereDto) {
    return this.plannMagService.searchMatieresPremières(dto);
  }

  /** GET /plann-mag/matieres/:id — détail d'une matière première */
  @Get('matieres/:id')
  async getMatiere(@Param('id', ParseIntPipe) id: number) {
    return this.plannMagService.getMatierePremiere(id);
  }

  /** POST /plann-mag/matieres — créer une nouvelle matière première */
  @Post('matieres')
  async createMatiere(@Body() dto: CreateMatierePremiereDto) {
    return this.plannMagService.createMatierePremiere(dto);
  }

  /** PATCH /plann-mag/matieres/:id — modifier partiellement une matière première */
  @Patch('matieres/:id')
  async updateMatiere(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMatierePremiereDto,
  ) {
    return this.plannMagService.updateMatierePremiere(id, dto);
  }

  /** DELETE /plann-mag/matieres/:id — supprimer une matière première */
  @Delete('matieres/:id')
  async deleteMatiere(@Param('id', ParseIntPipe) id: number) {
    return this.plannMagService.deleteMatierePremiere(id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENDPOINTS EXISTANTS (inchangés)
  // ══════════════════════════════════════════════════════════════════════════

  /** POST /plann-mag — Body: { semaine } */
  @Post()
  async getPlanningMagasin(@Body() dto: GetPlannMagDto) {
    return this.plannMagService.getPlanningMagasin(dto.semaine);
  }

  /** POST /plann-mag/ofs-by-date — Body: { annee, date } */
  @Post('ofs-by-date')
  async getOfsByDate(@Body() dto: GetOfsByDateDto) {
    return this.plannMagService.getOfsByDate(dto.annee, dto.date);
  }

  /** POST /plann-mag/search-by-date — Body: { annee, date, of? } */
  @Post('search-by-date')
  async searchByDate(@Body() dto: SearchByDateDto): Promise<any> {
    return this.plannMagService.searchByDate(dto.annee, dto.date, dto.of);
  }

  /** POST /plann-mag/search — Body: { annee, of, date } */
  @Post('search')
  async searchByOfAndDate(@Body() dto: SearchPlannMagDto) {
    return this.plannMagService.searchByOfAndDate(dto.annee, dto.of, dto.date);
  }

  /** POST /plann-mag/scan — Body: { codeDocument } */
  @Post('scan')
  async scanDocument(@Body() dto: ScanDocumentDto, @Request() req: any) {
    const serviPar = req.user?.username || req.user?.email || null;
    return this.plannMagService.scanDocument(dto.codeDocument, serviPar);
  }
}