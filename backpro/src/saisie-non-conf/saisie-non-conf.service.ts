// src/saisie-non-conf/saisie-non-conf.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaisieNonConf } from './entities/saisie-non-conf.entity';
import { CreateSaisieNonConfDto } from './dto/create-saisie-non-conf.dto';
import { UpdateSaisieNonConfDto } from './dto/update-saisie-non-conf.dto';
import { MatierePremier } from '../matiere-premier/entities/matiere-premier.entity';
import { Product } from '../product/entities/product.entity';
import { Not } from 'typeorm';

@Injectable()
export class SaisieNonConfService {
  constructor(
    @InjectRepository(SaisieNonConf)
    private saisieRepository: Repository<SaisieNonConf>,
    
    @InjectRepository(MatierePremier)
    private matierePremierRepository: Repository<MatierePremier>,
    
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  // CREATE (déjà fourni avec modifications)
 async create(createSaisieDto: CreateSaisieNonConfDto): Promise<SaisieNonConf> {
  // Validation: si sourceType = 'interne', typeInterne est obligatoire
  if (createSaisieDto.sourceType === 'interne' && !createSaisieDto.typeInterne) {
    throw new BadRequestException('Le type interne est obligatoire lorsque la source est "interne"');
  }

  // Validation: si sourceType = 'fournisseur', typeInterne doit être null
  if (createSaisieDto.sourceType === 'fournisseur' && createSaisieDto.typeInterne) {
    throw new BadRequestException('Le type interne ne peut pas être défini lorsque la source est "fournisseur"');
  }

  // Vérifier que la référence appartient bien à la ligne choisie
  const isValidReferenceForLine = await this.isValidReferenceForLine(
    createSaisieDto.reference, 
    createSaisieDto.ligne
  );
  
  if (!isValidReferenceForLine) {
    throw new ConflictException(
      `La référence ${createSaisieDto.reference} n'appartient pas à la ligne ${createSaisieDto.ligne}`
    );
  }

  // Déterminer automatiquement le type (MP ou SE) basé sur la référence
  const referenceType = await this.getReferenceType(createSaisieDto.reference);
  if (referenceType && createSaisieDto.type !== referenceType) {
    throw new BadRequestException(
      `Le type "${createSaisieDto.type}" ne correspond pas à la référence. ` +
      `Cette référence est de type "${referenceType}"`
    );
  }

  // Validation du statut si fourni
  if (createSaisieDto.statut) {
    const statutsValides = ['en attente', 'déclaré'];
    if (!statutsValides.includes(createSaisieDto.statut)) {
      throw new BadRequestException(`Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}`);
    }
  }

  // Vérifier si un enregistrement similaire existe déjà
  const existing = await this.saisieRepository.findOne({
    where: {
      sourceType: createSaisieDto.sourceType,
      ligne: createSaisieDto.ligne,
      reference: createSaisieDto.reference,
      date: new Date(createSaisieDto.date)
    }
  });

  if (existing) {
    throw new ConflictException('Une saisie avec ces mêmes informations existe déjà');
  }

  // Créer la saisie avec le statut (par défaut 'en attente' si non spécifié)
  const saisie = this.saisieRepository.create({
    ...createSaisieDto,
    date: new Date(createSaisieDto.date),
    statut: createSaisieDto.statut || 'en attente' // Valeur par défaut
  });

  return await this.saisieRepository.save(saisie);
}

  // FIND ALL
  async findAll(): Promise<SaisieNonConf[]> {
    return await this.saisieRepository.find({
      order: { date: 'DESC', createdAt: 'DESC' }
    });
  }

  // FIND ONE
  async findOne(id: number): Promise<SaisieNonConf> {
    const saisie = await this.saisieRepository.findOne({ where: { id } });
    
    if (!saisie) {
      throw new NotFoundException(`Saisie non-conformité avec ID ${id} non trouvée`);
    }
    
    return saisie;
  }

  // UPDATE
async update(id: number, updateSaisieDto: UpdateSaisieNonConfDto): Promise<SaisieNonConf> {
  const saisie = await this.findOne(id);
  
  // Validation: si sourceType = 'interne', typeInterne est obligatoire
  if (updateSaisieDto.sourceType === 'interne' && !updateSaisieDto.typeInterne) {
    throw new BadRequestException('Le type interne est obligatoire lorsque la source est "interne"');
  }

  // Validation: si sourceType = 'fournisseur', typeInterne doit être null
  if (updateSaisieDto.sourceType === 'fournisseur' && updateSaisieDto.typeInterne) {
    throw new BadRequestException('Le type interne ne peut pas être défini lorsque la source est "fournisseur"');
  }

  // Validation du statut si fourni
  if (updateSaisieDto.statut !== undefined) {
    const statutsValides = ['en attente', 'déclaré'];
    if (!statutsValides.includes(updateSaisieDto.statut)) {
      throw new BadRequestException(`Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}`);
    }
    saisie.statut = updateSaisieDto.statut;
  }

  // Mettre à jour seulement les champs fournis
  if (updateSaisieDto.sourceType !== undefined) {
    saisie.sourceType = updateSaisieDto.sourceType;
  }
  
  // Gestion de la ligne et référence avec la nouvelle logique
  if (updateSaisieDto.ligne !== undefined || updateSaisieDto.reference !== undefined) {
    const newLigne = updateSaisieDto.ligne !== undefined ? updateSaisieDto.ligne : saisie.ligne;
    const newReference = updateSaisieDto.reference !== undefined ? updateSaisieDto.reference : saisie.reference;
    
    // Vérifier la cohérence ligne/référence
    if (updateSaisieDto.reference !== undefined || updateSaisieDto.ligne !== undefined) {
      const isValidReferenceForLine = await this.isValidReferenceForLine(newReference, newLigne);
      
      if (!isValidReferenceForLine) {
        throw new ConflictException(
          `La référence ${newReference} n'appartient pas à la ligne ${newLigne}`
        );
      }
      
      // Mettre à jour le type automatiquement si la référence change
      if (updateSaisieDto.reference !== undefined) {
        const referenceType = await this.getReferenceType(newReference);
        if (referenceType) {
          saisie.type = referenceType; // Met à jour automatiquement le type
        }
      }
    }
    
    if (updateSaisieDto.ligne !== undefined) {
      saisie.ligne = updateSaisieDto.ligne;
    }
    
    if (updateSaisieDto.reference !== undefined) {
      saisie.reference = updateSaisieDto.reference;
    }
  }
  
  if (updateSaisieDto.qteRebut !== undefined) {
    saisie.qteRebut = updateSaisieDto.qteRebut;
  }
  
  if (updateSaisieDto.defauts !== undefined) {
    saisie.defauts = updateSaisieDto.defauts;
  }
  
  if (updateSaisieDto.type !== undefined) {
    // Si le type est modifié manuellement, vérifier qu'il correspond à la référence
    const referenceType = await this.getReferenceType(saisie.reference);
    if (referenceType && updateSaisieDto.type !== referenceType) {
      throw new BadRequestException(
        `Le type "${updateSaisieDto.type}" ne correspond pas à la référence. ` +
        `Cette référence est de type "${referenceType}"`
      );
    }
    saisie.type = updateSaisieDto.type;
  }
  
  if (updateSaisieDto.sortieLigne !== undefined) {
    saisie.sortieLigne = updateSaisieDto.sortieLigne;
  }
  
  if (updateSaisieDto.date !== undefined) {
    saisie.date = new Date(updateSaisieDto.date);
  }
  
  if (updateSaisieDto.createdById !== undefined) {
    saisie.createdById = updateSaisieDto.createdById;
  }
  
  // Vérifier si un autre enregistrement similaire existe déjà (conflit)
  if (updateSaisieDto.sourceType !== undefined || 
      updateSaisieDto.ligne !== undefined || 
      updateSaisieDto.reference !== undefined || 
      updateSaisieDto.date !== undefined) {
    
    const existing = await this.saisieRepository.findOne({
      where: {
        sourceType: saisie.sourceType,
        ligne: saisie.ligne,
        reference: saisie.reference,
        date: saisie.date,
        id: Not(saisie.id) // Exclure l'enregistrement actuel
      }
    });
    
    if (existing) {
      throw new ConflictException('Une autre saisie avec ces mêmes informations existe déjà');
    }
  }
  
  return await this.saisieRepository.save(saisie);
}


// Dans saisie-non-conf.service.ts

// Dans la classe SaisieNonConfService, ajoutez ces méthodes :

// Recherche par statut
async findByStatut(statut: string): Promise<SaisieNonConf[]> {
  return await this.saisieRepository.find({
    where: { statut },
    order: { date: 'DESC' }
  });
}

// Statistiques par statut
async getStatsByStatut(): Promise<any> {
  const stats = await this.saisieRepository
    .createQueryBuilder('saisie')
    .select('saisie.statut', 'statut')
    .addSelect('COUNT(saisie.id)', 'nombreSaisies')
    .addSelect('SUM(saisie.qteRebut)', 'totalRebut')
    .groupBy('saisie.statut')
    .orderBy('totalRebut', 'DESC')
    .getRawMany();
  
  return stats.map(stat => ({
    statut: stat.statut,
    nombreSaisies: parseInt(stat.nombreSaisies) || 0,
    totalRebut: parseInt(stat.totalRebut) || 0
  }));
}

// Mise à jour du statut uniquement
async updateStatut(id: number, statut: string): Promise<SaisieNonConf> {
  const saisie = await this.findOne(id);
  
  const statutsValides = ['en attente', 'déclaré'];
  if (!statutsValides.includes(statut)) {
    throw new BadRequestException(`Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}`);
  }
  
  // Validation métier : on ne peut pas repasser de 'déclaré' à 'en attente'
  if (saisie.statut === 'déclaré' && statut === 'en attente') {
    throw new BadRequestException('Impossible de repasser un rapport déclaré en statut "en attente"');
  }
  
  saisie.statut = statut;
  return await this.saisieRepository.save(saisie);
}
  // REMOVE
  async remove(id: number): Promise<void> {
    const saisie = await this.findOne(id);
    await this.saisieRepository.remove(saisie);
  }

  // GET ALL LINES (nouvelle méthode)
  async getAllLines(): Promise<string[]> {
    // Récupérer les lignes distinctes des matières premières
    const mpLines = await this.matierePremierRepository
      .createQueryBuilder('mp')
      .select('DISTINCT(mp.ligne)', 'ligne')
      .where('mp.ligne IS NOT NULL')
      .getRawMany();
    
    // Récupérer les lignes distinctes des produits
    const productLines = await this.productRepository
      .createQueryBuilder('p')
      .select('DISTINCT(p.ligne)', 'ligne')
      .where('p.ligne IS NOT NULL')
      .getRawMany();
    
    // Fusionner et dédupliquer
    const allLines = [
      ...mpLines.map(item => item.ligne),
      ...productLines.map(item => item.ligne)
    ];
    
    return [...new Set(allLines)].sort(); // Supprime les doublons et trie
  }

  // GET REFERENCES BY LINE (nouvelle méthode)
  async getReferencesByLine(ligne: string): Promise<Array<{reference: string, type: string}>> {
    const matieresPremieres = await this.matierePremierRepository.find({
      where: { ligne },
      select: ['refMatierePremier']
    });
    
    const products = await this.productRepository.find({
      where: { ligne },
      select: ['reference']
    });
    
    const result = [
      ...matieresPremieres.map(mp => ({
        reference: mp.refMatierePremier,
        type: 'MP'
      })),
      ...products.map(p => ({
        reference: p.reference,
        type: 'SE'
      }))
    ];
    
    return result;
  }

  // GET ALL REFERENCES WITH LINES (pour compatibilité)
  async getAllReferencesWithLines(): Promise<Array<{reference: string, ligne: string, type: string}>> {
    const matieresPremieres = await this.matierePremierRepository.find({
      select: ['refMatierePremier', 'ligne']
    });
    
    const products = await this.productRepository.find({
      select: ['reference', 'ligne']
    });
    
    const result = [
      ...matieresPremieres.map(mp => ({
        reference: mp.refMatierePremier,
        ligne: mp.ligne,
        type: 'MP'
      })),
      ...products.map(p => ({
        reference: p.reference,
        ligne: p.ligne,
        type: 'SE'
      }))
    ];
    
    return result;
  }

  // GET DEFAUTS LIST
  async getDefautsList(): Promise<string[]> {
    const saisies = await this.saisieRepository
      .createQueryBuilder('saisie')
      .select('DISTINCT(saisie.defauts)', 'defaut')
      .where('saisie.defauts IS NOT NULL')
      .orderBy('defaut')
      .getRawMany();
    
    return saisies.map(s => s.defaut);
  }

  // STATISTIQUES
  async getStats(): Promise<any> {
    const total = await this.saisieRepository.count();
    const totalQteRebut = await this.saisieRepository
      .createQueryBuilder('saisie')
      .select('SUM(saisie.qteRebut)', 'total')
      .getRawOne();
    
    return {
      totalSaisies: total,
      totalQteRebut: parseInt(totalQteRebut.total) || 0
    };
  }

  // RECHERCHE PAR PÉRIODE
  async findByDateRange(startDate: string, endDate: string): Promise<SaisieNonConf[]> {
    return await this.saisieRepository
      .createQueryBuilder('saisie')
      .where('saisie.date BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      })
      .orderBy('saisie.date', 'DESC')
      .getMany();
  }

  // RECHERCHE PAR LIGNE (nouvelle méthode)
  async findByLine(ligne: string): Promise<SaisieNonConf[]> {
    return await this.saisieRepository.find({
      where: { ligne },
      order: { date: 'DESC' }
    });
  }

  // RECHERCHE PAR RÉFÉRENCE (nouvelle méthode)
  async findByReference(reference: string): Promise<SaisieNonConf[]> {
    return await this.saisieRepository.find({
      where: { reference },
      order: { date: 'DESC' }
    });
  }

  // MÉTHODES PRIVÉES
  private async isValidReferenceForLine(reference: string, ligne: string): Promise<boolean> {
    // Chercher dans matiere_premier
    const matierePremier = await this.matierePremierRepository.findOne({
      where: { 
        refMatierePremier: reference,
        ligne: ligne
      }
    });
    
    if (matierePremier) {
      return true;
    }
    
    // Chercher dans products
    const product = await this.productRepository.findOne({
      where: { 
        reference: reference,
        ligne: ligne
      }
    });
    
    return !!product;
  }

  private async getReferenceType(reference: string): Promise<string | null> {
    // Chercher d'abord dans matiere_premier
    const matierePremier = await this.matierePremierRepository.findOne({
      where: { refMatierePremier: reference }
    });
    
    if (matierePremier) {
      return 'MP';
    }
    
    // Chercher ensuite dans products
    const product = await this.productRepository.findOne({
      where: { reference: reference }
    });
    
    if (product) {
      return 'SE';
    }
    
    return null;
  }

  // RECHERCHE AVANCÉE (nouvelle méthode)
  async search(filters: {
    ligne?: string;
    reference?: string;
    sourceType?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SaisieNonConf[]> {
    const queryBuilder = this.saisieRepository.createQueryBuilder('saisie');
    
    if (filters.ligne) {
      queryBuilder.andWhere('saisie.ligne = :ligne', { ligne: filters.ligne });
    }
    
    if (filters.reference) {
      queryBuilder.andWhere('saisie.reference = :reference', { reference: filters.reference });
    }
    
    if (filters.sourceType) {
      queryBuilder.andWhere('saisie.sourceType = :sourceType', { sourceType: filters.sourceType });
    }
    
    if (filters.type) {
      queryBuilder.andWhere('saisie.type = :type', { type: filters.type });
    }
    
    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('saisie.date BETWEEN :startDate AND :endDate', {
        startDate: new Date(filters.startDate),
        endDate: new Date(filters.endDate)
      });
    } else if (filters.startDate) {
      queryBuilder.andWhere('saisie.date >= :startDate', {
        startDate: new Date(filters.startDate)
      });
    } else if (filters.endDate) {
      queryBuilder.andWhere('saisie.date <= :endDate', {
        endDate: new Date(filters.endDate)
      });
    }
    
    queryBuilder.orderBy('saisie.date', 'DESC');
    
    return await queryBuilder.getMany();
  }

  // STATISTIQUES PAR LIGNE (nouvelle méthode)
  async getStatsByLine(): Promise<any> {
    const stats = await this.saisieRepository
      .createQueryBuilder('saisie')
      .select('saisie.ligne', 'ligne')
      .addSelect('COUNT(saisie.id)', 'nombreSaisies')
      .addSelect('SUM(saisie.qteRebut)', 'totalRebut')
      .groupBy('saisie.ligne')
      .orderBy('totalRebut', 'DESC')
      .getRawMany();
    
    return stats.map(stat => ({
      ligne: stat.ligne,
      nombreSaisies: parseInt(stat.nombreSaisies) || 0,
      totalRebut: parseInt(stat.totalRebut) || 0
    }));
  }

  // STATISTIQUES PAR TYPE (nouvelle méthode)
  async getStatsByType(): Promise<any> {
    const stats = await this.saisieRepository
      .createQueryBuilder('saisie')
      .select('saisie.type', 'type')
      .addSelect('COUNT(saisie.id)', 'nombreSaisies')
      .addSelect('SUM(saisie.qteRebut)', 'totalRebut')
      .groupBy('saisie.type')
      .orderBy('totalRebut', 'DESC')
      .getRawMany();
    
    return stats.map(stat => ({
      type: stat.type,
      nombreSaisies: parseInt(stat.nombreSaisies) || 0,
      totalRebut: parseInt(stat.totalRebut) || 0
    }));
  }
}