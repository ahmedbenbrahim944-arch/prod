// src/production/production.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { ProductionRecord } from './entities/production-record.entity';
import { Product } from '../product/entities/product.entity';
import { CreateProductionDto } from './dto/create-production.dto';
import { SearchProductionDto } from './dto/search-production.dto';

@Injectable()
export class ProductionService {
  constructor(
    @InjectRepository(ProductionRecord)
    private productionRepo: Repository<ProductionRecord>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
  ) {}

  /**
   * Parser le QR code
   * Format: REFERENCE/QUANTITE/DERNIERE_PARTIE
   * Exemple: RA5246804/200/47242
   */
 parseQRCode(qrCode: string): { reference: string; quantite: number; dernierePartie: string | null } {
  // Liste des séparateurs possibles
  const separators = ['/', '-', '_', ':'];
  let separator: string | null = null;
  
  for (const sep of separators) {
    if (qrCode.includes(sep)) {
      separator = sep;
      break;
    }
  }
  
  if (!separator) {
    throw new BadRequestException(
      `Format QR code invalide. Utilisez l'un de ces séparateurs: ${separators.join(', ')}. Reçu: "${qrCode}"`,
    );
  }

  const parts = qrCode.split(separator);

  if (parts.length < 2) {
    throw new BadRequestException(
      `Format QR code invalide. Attendu: REFERENCE${separator}QUANTITE${separator}DERNIERE_PARTIE. Reçu: "${qrCode}"`,
    );
  }

  const reference = parts[0].trim();
  const quantite = parseInt(parts[1], 10);
  const dernierePartie = parts[2]?.trim() || null;

  if (!reference) {
    throw new BadRequestException('Référence manquante dans le QR code');
  }

  if (isNaN(quantite) || quantite <= 0) {
    throw new BadRequestException(
      `Quantité invalide dans le QR code: "${parts[1]}" doit être un nombre positif`,
    );
  }

  return { reference, quantite, dernierePartie };
}

  /**
   * Trouver la ligne à partir d'une référence produit
   */
  async findLigneByReference(reference: string): Promise<string> {
    const product = await this.productRepo.findOne({
      where: { reference },
    });

    if (!product) {
      throw new NotFoundException(
        `Référence "${reference}" introuvable dans le catalogue produits`,
      );
    }

    return product.ligne;
  }

  /**
   * Scanner un QR code et enregistrer la production
   */
  async scanProduction(dto: CreateProductionDto): Promise<ProductionRecord> {
    // 1. Parser le QR code
    const { reference, quantite, dernierePartie } = this.parseQRCode(dto.qrCode);

    // 2. Trouver la ligne correspondante
    const ligne = await this.findLigneByReference(reference);

    // 3. Créer l'enregistrement
    const record = this.productionRepo.create({
      ligne,
      reference,
      quantite: dto.quantite || quantite, // Priorité au DTO si fourni
      codeOriginal: dto.qrCode,
      dernierePartie: dernierePartie, // Peut être null
      scanneParId: dto.scanneParId || null,
    });

    return this.productionRepo.save(record);
  }

  /**
   * Rechercher les enregistrements de production
   */
  async searchProductions(searchDto: SearchProductionDto): Promise<{
    data: ProductionRecord[];
    total: number;
    totalQuantite: number;
    page: number;
    limit: number;
  }> {
    const { ligne, reference, dateDebut, dateFin, page = 1, limit = 50 } = searchDto;

    const where: FindOptionsWhere<ProductionRecord> = {};

    if (ligne) {
      where.ligne = ligne;
    }

    if (reference) {
      where.reference = reference;
    }

    if (dateDebut && dateFin) {
      const start = new Date(dateDebut);
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);
      where.dateScan = Between(start, end);
    } else if (dateDebut) {
      const start = new Date(dateDebut);
      where.dateScan = MoreThanOrEqual(start);
    } else if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);
      where.dateScan = LessThanOrEqual(end);
    }

    const [data, total] = await this.productionRepo.findAndCount({
      where,
      order: { dateScan: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculer la somme des quantités
    const totalQuantiteResult = await this.productionRepo
      .createQueryBuilder('production')
      .select('SUM(production.quantite)', 'total')
      .where(where)
      .getRawOne();

    const totalQuantite = parseInt(totalQuantiteResult?.total || '0', 10);

    return {
      data,
      total,
      totalQuantite,
      page,
      limit,
    };
  }

  /**
   * Obtenir la production par ligne et plage de dates (simplifié)
   */
  async getProductionByLigneAndDate(
    ligne: string,
    dateDebut: Date,
    dateFin: Date,
  ): Promise<{
    ligne: string;
    totalQuantite: number;
    records: ProductionRecord[];
  }> {
    const endDate = new Date(dateFin);
    endDate.setHours(23, 59, 59, 999);

    const records = await this.productionRepo.find({
      where: {
        ligne,
        dateScan: Between(dateDebut, endDate),
      },
      order: { dateScan: 'ASC' },
    });

    const totalQuantite = records.reduce((sum, record) => sum + record.quantite, 0);

    return {
      ligne,
      totalQuantite,
      records,
    };
  }

  /**
   * Obtenir tous les enregistrements (avec pagination)
   */
  async findAll(page: number = 1, limit: number = 50): Promise<{
    data: ProductionRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [data, total] = await this.productionRepo.findAndCount({
      order: { dateScan: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  /**
   * Trouver un enregistrement par ID
   */
  async findOne(id: number): Promise<ProductionRecord> {
    const record = await this.productionRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Enregistrement de production id=${id} introuvable`);
    }
    return record;
  }

  /**
   * Supprimer un enregistrement
   */
  async remove(id: number): Promise<void> {
    const record = await this.findOne(id);
    await this.productionRepo.remove(record);
  }

  /**
   * Statistiques globales
   */
  async getStats(): Promise<{
    totalRecords: number;
    totalQuantite: number;
    topLines: { ligne: string; totalQuantite: number }[];
  }> {
    const totalRecords = await this.productionRepo.count();

    const totalQuantiteResult = await this.productionRepo
      .createQueryBuilder('production')
      .select('SUM(production.quantite)', 'total')
      .getRawOne();
    const totalQuantite = parseInt(totalQuantiteResult?.total || '0', 10);

    const topLinesResult = await this.productionRepo
      .createQueryBuilder('production')
      .select('production.ligne', 'ligne')
      .addSelect('SUM(production.quantite)', 'totalQuantite')
      .groupBy('production.ligne')
      .orderBy('totalQuantite', 'DESC')
      .limit(5)
      .getRawMany();

    const topLines = topLinesResult.map((item) => ({
      ligne: item.ligne,
      totalQuantite: parseInt(item.totalQuantite, 10),
    }));

    return {
      totalRecords,
      totalQuantite,
      topLines,
    };
  }
}