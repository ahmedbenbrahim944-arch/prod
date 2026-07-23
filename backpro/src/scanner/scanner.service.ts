// src/scanner/scanner.service.ts
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScannerRecord } from './entities/scanner-record.entity';
import { CodeProduit } from './entities/code-produit.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { CreateScanDto } from './dto/create-scan.dto';

export interface ParsedFullnumber {
  annee: string;
  semaine: string;
  compteur: string;
  codeProduit: string;
  fournisseur: string;
  indice: string;
}

@Injectable()
export class ScannerService {
  constructor(
    @InjectRepository(ScannerRecord)
    private readonly scannerRepo: Repository<ScannerRecord>,

    @InjectRepository(CodeProduit)
    private readonly codeProduitRepo: Repository<CodeProduit>,

    @InjectRepository(Semaine)
    private readonly semaineRepo: Repository<Semaine>,
  ) {}

  // ─── Parsing du fullnumber ────────────────────────────────────────────────
  parseFullnumber(fullnumber: string): ParsedFullnumber {
    if (fullnumber.length !== 16) {
      throw new BadRequestException(
        `Fullnumber invalide : longueur ${fullnumber.length} au lieu de 16. Reçu : "${fullnumber}"`,
      );
    }

    const annee       = fullnumber.slice(0, 1);
    const semaine     = fullnumber.slice(1, 3);
    const compteur    = fullnumber.slice(3, 7);
    const codeProduit = fullnumber.slice(7, 11);
    const fournisseur = fullnumber.slice(11, 13);
    const indice      = fullnumber.slice(13, 16);

    if (!/^[A-Z]$/.test(annee))
      throw new BadRequestException(`Année invalide : "${annee}"`);
    if (!/^\d{2}$/.test(semaine))
      throw new BadRequestException(`Semaine invalide : "${semaine}"`);
    if (!/^\d{4}$/.test(compteur))
      throw new BadRequestException(`Compteur invalide : "${compteur}"`);
    if (!/^\d{4}$/.test(codeProduit))
      throw new BadRequestException(`Code produit invalide : "${codeProduit}"`);
    if (!/^[A-Z]\d$/.test(fournisseur))
      throw new BadRequestException(`Fournisseur invalide : "${fournisseur}"`);
    if (!/^[A-Z0-9]{3}$/.test(indice))
      throw new BadRequestException(`Indice invalide : "${indice}" (3 chars alphanumériques ex: 115, M10, 04S)`);

    return { annee, semaine, compteur, codeProduit, fournisseur, indice };
  }

  // ─── Créer un scan ────────────────────────────────────────────────────────
  async createScan(dto: CreateScanDto): Promise<ScannerRecord> {

    // 1. Normalisation défensive
    const fnNormalized = dto.fullnumber.trim().toUpperCase();

    // 2. Vérifier doublon
    const existing = await this.scannerRepo.findOne({ where: { fullnumber: fnNormalized } });
    if (existing) {
      throw new ConflictException(
        `Ce ticket a déjà été scanné : "${fnNormalized}" — scanné le ${existing.scannedAt.toLocaleDateString('fr-FR')}`,
      );
    }

    // 3. Vérifier semaine
    const semaine = await this.semaineRepo.findOne({ where: { id: dto.semaineId } });
    if (!semaine) throw new NotFoundException(`Semaine id=${dto.semaineId} introuvable`);

    // 4. Parser le fullnumber
    const parsed = this.parseFullnumber(fnNormalized);

    // 5. Chercher le premier code produit correspondant (s'il existe)
    const codeProduitEntity = await this.codeProduitRepo.findOne({
      where: { code: parsed.codeProduit },
    }) ?? null;

    return this._saveRecord(fnNormalized, parsed, dto, codeProduitEntity);
  }

  // ─── Helper : sauvegarder l'enregistrement ────────────────────────────────
  private async _saveRecord(
    fullnumber: string,
    parsed: ParsedFullnumber,
    dto: CreateScanDto,
    codeProduitEntity: CodeProduit | null,
  ): Promise<ScannerRecord> {
    const record = this.scannerRepo.create({
      fullnumber,
      annee:             parsed.annee,
      semaineParsed:     parsed.semaine,
      compteur:          parsed.compteur,
      codeProduitParsed: parsed.codeProduit,
      fournisseur:       parsed.fournisseur,
      indice:            parsed.indice,
      reference:         codeProduitEntity?.reference ?? null,
      ligne:             codeProduitEntity?.ligne ?? null,
      semaineId:         dto.semaineId,
      scanneParId:       dto.scanneParId,
      codeProduitId:     codeProduitEntity?.id ?? null,
      ligneChoix:        dto.ligneChoix ?? null,  // 'L1', 'L2', ou null
    });
    return this.scannerRepo.save(record);
  }

  // ─── Lister les scans d'une semaine ──────────────────────────────────────
  async findBySemaine(semaineId: number): Promise<ScannerRecord[]> {
    return this.scannerRepo.find({
      where: { semaineId },
      order: { scannedAt: 'DESC' },
    });
  }

  // ─── Lister tous les scans ────────────────────────────────────────────────
  async findAll(): Promise<ScannerRecord[]> {
    return this.scannerRepo.find({ order: { scannedAt: 'DESC' } });
  }

  // ─── Trouver un scan par id ───────────────────────────────────────────────
  async findOne(id: number): Promise<ScannerRecord> {
    const record = await this.scannerRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Scan id=${id} introuvable`);
    return record;
  }

  // ─── Trouver un scan par fullnumber ──────────────────────────────────────
  async findByFullnumber(fullnumber: string): Promise<ScannerRecord> {
    const record = await this.scannerRepo.findOne({ where: { fullnumber } });
    if (!record) throw new NotFoundException(`Fullnumber "${fullnumber}" introuvable`);
    return record;
  }

  // ─── Supprimer un scan ───────────────────────────────────────────────────
  async remove(id: number): Promise<void> {
    const record = await this.findOne(id);
    await this.scannerRepo.remove(record);
  }

  // ─── Lister tous les codes produit ───────────────────────────────────────
  async findAllCodeProduit(): Promise<CodeProduit[]> {
    return this.codeProduitRepo.find({ order: { code: 'ASC' } });
  }
}