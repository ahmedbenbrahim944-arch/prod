// stats.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  BadRequestException
} from '@nestjs/common';
import { StatsService } from './stats.service';
import { GetStatsDto } from './dto/get-stats.dto';
import { GetStatsLignesDto } from './dto/get-stats-lignes.dto';
import { GetStatsSemaineDto } from './dto/get-stats-semaine.dto';
import { GetStatsDateDto } from './dto/get-stats-date.dto';
import { GetStatsAnnuelDto } from './dto/get-stats-annuel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetAffectationPersonnelDto } from './dto/get-affectation-personnel.dto';
import { GetStats5MDateDto } from './dto/get-stats-5m-date.dto';
import { GetProductiviteOuvriersDto } from './dto/get-productivite-ouvriers.dto';
import { GetStatsPeriodeDto } from './dto/get-stats-periode.dto';
import { GetStatsSelectionDto } from './dto/get-stats-selection.dto';

// ─── Constantes ────────────────────────────────────────────────────────────────
const POSTES_VALIDES = ['poste1', 'poste2'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Valide le format du poste en GET query (car pas de ValidationPipe sur les @Query) */
function validerPoste(poste?: string): void {
  if (poste && !POSTES_VALIDES.includes(poste)) {
    throw new BadRequestException('Le poste doit être "poste1" ou "poste2"');
  }
}

/** Valide le format d'une date YYYY-MM-DD */
function validerDate(date: string, label = 'date'): void {
  if (!DATE_REGEX.test(date)) {
    throw new BadRequestException(
      `Le format de ${label} doit être YYYY-MM-DD`
    );
  }
}

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats  — Stats par semaine + ligne
  // Body: { semaine, ligne, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStatsBySemaineAndLigne(@Body() dto: GetStatsDto) {
    return this.statsService.getStatsBySemaineAndLigne(dto.semaine, dto.ligne, dto.poste);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/lignes  — PCS prod total par ligne
  // Body: { semaine, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('lignes')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getPcsProdTotalParLigne(@Body() dto: GetStatsLignesDto) {
    return this.statsService.getPcsProdTotalParLigne(dto.semaine, dto.poste);
  }

  @Get('lignes')
  @UseGuards(JwtAuthGuard)
  async getPcsProdTotalParLigneQuery(
    @Query('semaine') semaine: string,
    @Query('poste') poste?: string
  ) {
    validerPoste(poste);
    return this.statsService.getPcsProdTotalParLigne(semaine, poste);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/pourcentage-5m  — % 5M par semaine
  // Body: { semaine, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('pourcentage-5m')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getPourcentage5MParSemaine(@Body() dto: GetStatsSemaineDto) {
    return this.statsService.getStatsPourcentage5MParSemaine(dto.semaine, dto.poste);
  }

  @Get('pourcentage-5m')
  @UseGuards(JwtAuthGuard)
  async getPourcentage5MParSemaineQuery(
    @Query('semaine') semaine: string,
    @Query('poste') poste?: string
  ) {
    validerPoste(poste);
    return this.statsService.getStatsPourcentage5MParSemaine(semaine, poste);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/pourcentage-5m-ligne  — % 5M par ligne
  // Body: { semaine, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('pourcentage-5m-ligne')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getPourcentage5MParLigne(@Body() dto: GetStatsSemaineDto) {
    return this.statsService.getPourcentage5MParLigne(dto.semaine, dto.poste);
  }

  @Get('pourcentage-5m-ligne')
  @UseGuards(JwtAuthGuard)
  async getPourcentage5MParLigneQuery(
    @Query('semaine') semaine: string,
    @Query('poste') poste?: string
  ) {
    validerPoste(poste);
    return this.statsService.getPourcentage5MParLigne(semaine, poste);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/par-date  — Stats par date
  // Body: { date, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('par-date')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStatsParDate(@Body() dto: GetStatsDateDto) {
    return this.statsService.getStatsParDate(dto);
  }

  @Get('par-date')
  @UseGuards(JwtAuthGuard)
  async getStatsParDateQuery(
    @Query('date') date: string,
    @Query('poste') poste?: string
  ) {
    validerPoste(poste);
    const dto = new GetStatsDateDto();
    dto.date = date;
    dto.poste = poste;
    return this.statsService.getStatsParDate(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/rapports-saisie-date  — Rapports saisie par date
  // Body: { date, poste? }  (poste n'affecte pas les rapports, mais conservé pour cohérence)
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('rapports-saisie-date')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getRapportsSaisieParDate(@Body() dto: GetStatsDateDto) {
    return this.statsService.getRapportsSaisieParDate(dto);
  }

  @Get('rapports-saisie-date')
  @UseGuards(JwtAuthGuard)
  async getRapportsSaisieParDateQuery(@Query('date') date: string) {
    const dto = new GetStatsDateDto();
    dto.date = date;
    return this.statsService.getRapportsSaisieParDate(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/pcs-par-mois  — PCS par mois (annuel)
  // Body: { date, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('pcs-par-mois')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStatsPcsParMois(@Body() dto: GetStatsAnnuelDto) {
    return this.statsService.getStatsPcsParMoisEtLigne(dto);
  }

  @Get('pcs-par-mois')
  @UseGuards(JwtAuthGuard)
  async getStatsPcsParMoisQuery(
    @Query('date') date: string,
    @Query('poste') poste?: string
  ) {
    if (!date) throw new BadRequestException('Le paramètre "date" est obligatoire');
    validerDate(date);
    validerPoste(poste);
    const dto = new GetStatsAnnuelDto();
    dto.date = date;
    dto.poste = poste;
    return this.statsService.getStatsPcsParMoisEtLigne(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/5m-par-mois  — 5M par mois (annuel)
  // Body: { date, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('5m-par-mois')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStats5MParMois(@Body() dto: GetStatsAnnuelDto) {
    return this.statsService.getStats5MParMois(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/affectation-personnel  — Affectation personnel
  // Body: { semaine, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('affectation-personnel')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getAffectationPersonnel(@Body() dto: GetAffectationPersonnelDto) {
    return this.statsService.getAffectationPersonnel(dto.semaine, dto.poste);
  }

  @Get('affectation-personnel')
  @UseGuards(JwtAuthGuard)
  async getAffectationPersonnelQuery(
    @Query('semaine') semaine: string,
    @Query('poste') poste?: string
  ) {
    if (!semaine) throw new BadRequestException('Le paramètre "semaine" est obligatoire');
    validerPoste(poste);
    return this.statsService.getAffectationPersonnel(semaine, poste);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/5m-par-date  — 5M par ligne pour une date
  // Body: { date, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('5m-par-date')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStats5MParDate(@Body() dto: GetStats5MDateDto) {
    return this.statsService.getStats5MParDate(dto);
  }

  @Get('5m-par-date')
  @UseGuards(JwtAuthGuard)
  async getStats5MParDateQuery(
    @Query('date') date: string,
    @Query('poste') poste?: string
  ) {
    if (!date) throw new BadRequestException('Le paramètre "date" est obligatoire');
    validerDate(date);
    validerPoste(poste);
    const dto = new GetStats5MDateDto();
    dto.date = date;
    dto.poste = poste;
    return this.statsService.getStats5MParDate(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/productivite-ouvriers  — Productivité ouvriers sur période
  // Body: { dateDebut, dateFin, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('productivite-ouvriers')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getProductiviteOuvriers(@Body() dto: GetProductiviteOuvriersDto) {
    return this.statsService.getProductiviteOuvriers(dto.dateDebut, dto.dateFin, dto.poste);
  }

  @Get('productivite-ouvriers')
  @UseGuards(JwtAuthGuard)
  async getProductiviteOuvriersQuery(
    @Query('dateDebut') dateDebut: string,
    @Query('dateFin') dateFin: string,
    @Query('poste') poste?: string
  ) {
    if (!dateDebut || !dateFin) {
      throw new BadRequestException('Les paramètres "dateDebut" et "dateFin" sont obligatoires');
    }
    validerPoste(poste);
    return this.statsService.getProductiviteOuvriers(dateDebut, dateFin, poste);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // POST /stats/stats-periode  — Stats complètes sur une période
  // Body: { dateDebut, dateFin, poste? }
  // ──────────────────────────────────────────────────────────────────────────────
  @Post('stats-periode')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  async getStatsParPeriode(@Body() dto: GetStatsPeriodeDto) {
    return this.statsService.getStatsParPeriode(dto.dateDebut, dto.dateFin, dto.poste);
  }

  @Get('stats-periode')
  @UseGuards(JwtAuthGuard)
  async getStatsParPeriodeQuery(
    @Query('dateDebut') dateDebut: string,
    @Query('dateFin') dateFin: string,
    @Query('poste') poste?: string
  ) {
    if (!dateDebut || !dateFin) {
      throw new BadRequestException('Les paramètres "dateDebut" et "dateFin" sont obligatoires');
    }
    validerDate(dateDebut, 'dateDebut');
    validerDate(dateFin, 'dateFin');
    validerPoste(poste);
    return this.statsService.getStatsParPeriode(dateDebut, dateFin, poste);
  }
  @Post('personnes-selection')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@HttpCode(HttpStatus.OK)
async getPersonnesSelection(@Body() dto: GetStatsSelectionDto) {
  return this.statsService.getStatsPersonnesSelection(dto);
}
 
// ──────────────────────────────────────────────────────────────────────────────
// GET /stats/personnes-selection?dateDebut=YYYY-MM-DD&dateFin=YYYY-MM-DD
// ──────────────────────────────────────────────────────────────────────────────
@Get('personnes-selection')
@UseGuards(JwtAuthGuard)
async getPersonnesSelectionQuery(
  @Query('dateDebut') dateDebut: string,
  @Query('dateFin')   dateFin: string,
) {
  if (!dateDebut || !dateFin) {
    throw new BadRequestException(
      'Les paramètres "dateDebut" et "dateFin" sont obligatoires',
    );
  }
  validerDate(dateDebut, 'dateDebut');
  validerDate(dateFin,   'dateFin');
 
  const dto = new GetStatsSelectionDto();
  dto.dateDebut = dateDebut;
  dto.dateFin   = dateFin;
 
  return this.statsService.getStatsPersonnesSelection(dto);
}
}