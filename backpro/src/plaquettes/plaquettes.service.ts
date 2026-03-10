// src/plaquettes/plaquettes.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plaquette } from './entities/plaquette.entity';
import { Semaine } from '../semaine/entities/semaine.entity';
import { Product } from '../product/entities/product.entity';
import { MatriculeMachine } from './entities/matricule-machine.entity';
import { TypePlaquette } from './entities/type-plaquette.entity';
import { CreatePlaquetteDto } from './dto/create-plaquette.dto';
import { UpdatePlaquetteDto } from './dto/update-plaquette.dto';
import { FilterPlaquetteDto } from './dto/filter-plaquette.dto';

export interface TypeStat {
  typeId: number;
  typeNom: string;
  quantiteTotale: number;
  resteTotale: number;
  produitFiniTotal: number;
  rebutTotal: number;
  consommationTotale: number;
  pourcentageConsommation: number;
  pourcentageReste: number;
  pourcentageRebut: number;
}

export interface StatsResult {
  dateDebut: string;
  dateFin: string;
  statsParType: TypeStat[];
}

@Injectable()
export class PlaquettesService {
  constructor(
    @InjectRepository(Plaquette)
    private plaquetteRepository: Repository<Plaquette>,

    @InjectRepository(Semaine)
    private semaineRepository: Repository<Semaine>,

    @InjectRepository(Product)
    private productRepository: Repository<Product>,

    @InjectRepository(MatriculeMachine)
    private matriculeMachineRepository: Repository<MatriculeMachine>,

    @InjectRepository(TypePlaquette)
    private typePlaquetteRepository: Repository<TypePlaquette>,
  ) {}

  // ── Matricules ──────────────────────────────────────────────────
  async getMatriculesMachines(): Promise<MatriculeMachine[]> {
    return this.matriculeMachineRepository.find({ order: { matricule: 'ASC' } });
  }

  // ── Types plaquettes ────────────────────────────────────────────
  async getTypesPlaquettes(): Promise<TypePlaquette[]> {
    return this.typePlaquetteRepository.find({ order: { nom: 'ASC' } });
  }

  // ── Créer une plaquette ─────────────────────────────────────────
  async create(dto: CreatePlaquetteDto, admin: any): Promise<Plaquette> {
    const { semaineId, ligne, reference, matriculeMachineId, typePlaquetteId, quantiteDonnee } = dto;

    const semaine = await this.semaineRepository.findOne({ where: { id: semaineId } });
    if (!semaine) throw new NotFoundException(`Semaine #${semaineId} introuvable`);

    const ligneExiste = await this.productRepository.findOne({ where: { ligne } });
    if (!ligneExiste) throw new BadRequestException(`La ligne "${ligne}" n'existe pas`);

    const refExiste = await this.productRepository.findOne({ where: { ligne, reference } });
    if (!refExiste) throw new BadRequestException(`La référence "${reference}" n'appartient pas à "${ligne}"`);

    const matriculeMachine = await this.matriculeMachineRepository.findOne({ where: { id: matriculeMachineId } });
    if (!matriculeMachine) throw new NotFoundException(`Matricule #${matriculeMachineId} introuvable`);

    const typePlaquette = await this.typePlaquetteRepository.findOne({ where: { id: typePlaquetteId } });
    if (!typePlaquette) throw new NotFoundException(`Type plaquette #${typePlaquetteId} introuvable`);

    const plaquette = this.plaquetteRepository.create({
      date: new Date(),
      semaine,
      ligne,
      reference,
      matriculeMachine,
      typePlaquette,
      quantiteDonnee,
      reste: 0,
      produitFini: 0,
      rebut: 0,
      consommation: 0,
      creePar: admin,
    });

    return this.plaquetteRepository.save(plaquette);
  }

  // ── Mettre à jour Reste / Produit fini ──────────────────────────
  async update(id: number, dto: UpdatePlaquetteDto): Promise<Plaquette> {
    const plaquette = await this.plaquetteRepository.findOne({ where: { id } });
    if (!plaquette) throw new NotFoundException(`Plaquette #${id} introuvable`);

    if (dto.reste !== undefined) {
      if (dto.reste > plaquette.quantiteDonnee)
        throw new BadRequestException(`Le reste ne peut pas dépasser la quantité donnée (${plaquette.quantiteDonnee})`);
      plaquette.reste = dto.reste;
    }

    if (dto.produitFini !== undefined) plaquette.produitFini = dto.produitFini;
    if (dto.rebut !== undefined) plaquette.rebut = dto.rebut;

    plaquette.consommation = Number(plaquette.quantiteDonnee) - Number(plaquette.reste);
    return this.plaquetteRepository.save(plaquette);
  }

  // ── Supprimer ───────────────────────────────────────────────────
  async remove(id: number): Promise<{ message: string }> {
    const plaquette = await this.plaquetteRepository.findOne({ where: { id } });
    if (!plaquette) throw new NotFoundException(`Plaquette #${id} introuvable`);
    await this.plaquetteRepository.remove(plaquette);
    return { message: `Plaquette #${id} supprimée avec succès` };
  }

  // ── Lister avec filtres ─────────────────────────────────────────
  async findAll(filterDto: FilterPlaquetteDto): Promise<{ data: Plaquette[]; total: number }> {
    const query = this.plaquetteRepository
      .createQueryBuilder('plaquette')
      .leftJoinAndSelect('plaquette.semaine', 'semaine')
      .leftJoinAndSelect('plaquette.matriculeMachine', 'matriculeMachine')
      .leftJoinAndSelect('plaquette.typePlaquette', 'typePlaquette')
      .leftJoinAndSelect('plaquette.creePar', 'admin');

    if (filterDto.date)      query.andWhere('DATE(plaquette.date) = :date', { date: filterDto.date });
    if (filterDto.semaineId) query.andWhere('semaine.id = :semaineId', { semaineId: filterDto.semaineId });
    if (filterDto.semaine)   query.andWhere('semaine.nom = :semaine', { semaine: filterDto.semaine });
    if (filterDto.ligne)     query.andWhere('plaquette.ligne = :ligne', { ligne: filterDto.ligne });

    query.orderBy('plaquette.createdAt', 'DESC');
    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  // ── Récupérer une plaquette ─────────────────────────────────────
  async findOne(id: number): Promise<Plaquette> {
    const plaquette = await this.plaquetteRepository.findOne({
      where: { id },
      relations: ['semaine', 'matriculeMachine', 'typePlaquette', 'creePar'],
    });
    if (!plaquette) throw new NotFoundException(`Plaquette #${id} introuvable`);
    return plaquette;
  }

  // ────────────────────────────────────────────────────────────────
  // STATISTIQUES PAR TYPE sur une plage de dates
  // dateDebut et dateFin au format YYYY-MM-DD
  // ────────────────────────────────────────────────────────────────
  async getStatsByDateRange(dateDebut: string, dateFin: string): Promise<StatsResult> {
    // Récupérer toutes les plaquettes dans la plage de dates
    const plaquettes = await this.plaquetteRepository
      .createQueryBuilder('plaquette')
      .leftJoinAndSelect('plaquette.typePlaquette', 'typePlaquette')
      .where('DATE(plaquette.date) >= :dateDebut', { dateDebut })
      .andWhere('DATE(plaquette.date) <= :dateFin', { dateFin })
      .getMany();

    // Grouper par type
    const groupes = new Map<number, {
      typeId: number;
      typeNom: string;
      quantiteTotale: number;
      resteTotale: number;
      produitFiniTotal: number;
      rebutTotal: number;
      consommationTotale: number;
    }>();

    for (const p of plaquettes) {
      const typeId  = p.typePlaquette.id;
      const typeNom = p.typePlaquette.nom;

      if (!groupes.has(typeId)) {
        groupes.set(typeId, {
          typeId,
          typeNom,
          quantiteTotale:     0,
          resteTotale:        0,
          produitFiniTotal:   0,
          rebutTotal:         0,
          consommationTotale: 0,
        });
      }

      const g = groupes.get(typeId)!;
      g.quantiteTotale     += Number(p.quantiteDonnee);
      g.resteTotale        += Number(p.reste);
      g.produitFiniTotal   += Number(p.produitFini);
      g.rebutTotal         += Number((p as any).rebut ?? 0);
      g.consommationTotale += Number(p.consommation);
    }

    // Calculer les pourcentages
    const statsParType: TypeStat[] = Array.from(groupes.values()).map((g) => {
      const pctConso = g.quantiteTotale > 0
        ? Math.round((g.consommationTotale / g.quantiteTotale) * 10000) / 100
        : 0;
      const pctReste = g.quantiteTotale > 0
        ? Math.round((g.resteTotale / g.quantiteTotale) * 10000) / 100
        : 0;

      const pctRebut = g.quantiteTotale > 0
        ? Math.round((g.rebutTotal / g.quantiteTotale) * 10000) / 100
        : 0;
      return {
        ...g,
        pourcentageConsommation: pctConso,
        pourcentageReste:        pctReste,
        pourcentageRebut:        pctRebut,
      };
    });

    // Trier par nom de type
    statsParType.sort((a, b) => a.typeNom.localeCompare(b.typeNom));

    return { dateDebut, dateFin, statsParType };
  }
}