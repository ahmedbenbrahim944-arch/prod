import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatutManuel, TypeStatutManuel, TypeMaladie } from '../statut-manuel/entites/statut-manuel.entity'
import { CreateStatutManuelDto } from './dto/create-statut-manuel.dto';
import { UpdateStatutManuelDto } from '../statut-manuel/dto/update-statut-manuel.dto'

@Injectable()
export class StatutManuelService {
  constructor(
    @InjectRepository(StatutManuel)
    private repo: Repository<StatutManuel>,
  ) {}

  /**
   * Options pour peupler les selects du frontend :
   * - statuts disponibles
   * - sous-types maladie disponibles
   */
  getOptions() {
    return {
      statuts: Object.values(TypeStatutManuel),
      typesMaladie: Object.values(TypeMaladie),
    };
  }

  async create(dto: CreateStatutManuelDto): Promise<StatutManuel> {
    const statut = this.repo.create(dto);
    return this.repo.save(statut);
  }

  async findAll(): Promise<StatutManuel[]> {
    return this.repo.find({ order: { dateDebut: 'DESC' } });
  }

  async findOne(id: number): Promise<StatutManuel> {
    const statut = await this.repo.findOne({ where: { id } });
    if (!statut) throw new NotFoundException(`Statut manuel #${id} introuvable`);
    return statut;
  }

  async update(id: number, dto: UpdateStatutManuelDto): Promise<StatutManuel> {
    const statut = await this.findOne(id);
    Object.assign(statut, dto);
    return this.repo.save(statut);
  }

  async remove(id: number): Promise<{ message: string }> {
    const statut = await this.findOne(id);
    await this.repo.remove(statut);
    return { message: `Statut manuel supprimé` };
  }

  /**
   * Statuts actifs pour UNE date donnée (dateDebut <= date <= dateFin)
   * → Map<matricule, StatutManuel> pour lookup rapide.
   */
  async findActifsPourDate(date: Date): Promise<Map<string, StatutManuel>> {
    const dateStr = date.toISOString().split('T')[0];

    const statuts = await this.repo
      .createQueryBuilder('s')
      .where('s.dateDebut <= :dateStr', { dateStr })
      .andWhere('s.dateFin >= :dateStr', { dateStr })
      .getMany();

    const map = new Map<string, StatutManuel>();
    statuts.forEach((s) => map.set(s.matricule, s));
    return map;
  }

  /**
   * Statuts qui chevauchent une PÉRIODE [debut, fin]
   * → Map<matricule, StatutManuel> (UN SEUL statut par matricule — le dernier trouvé).
   * ⚠️ Ne pas utiliser pour un récap jour par jour si une personne peut avoir
   * plusieurs statuts différents sur la période → voir findAllActifsPourPeriode.
   */
  async findActifsPourPeriode(debut: Date, fin: Date): Promise<Map<string, StatutManuel>> {
    const debutStr = debut.toISOString().split('T')[0];
    const finStr = fin.toISOString().split('T')[0];

    const statuts = await this.repo
      .createQueryBuilder('s')
      .where('s.dateDebut <= :finStr', { finStr })
      .andWhere('s.dateFin >= :debutStr', { debutStr })
      .getMany();

    const map = new Map<string, StatutManuel>();
    statuts.forEach((s) => map.set(s.matricule, s));
    return map;
  }

  /**
   * ✅ NOUVEAU — Liste COMPLÈTE (non dédupliquée) des statuts qui chevauchent
   * une période. Nécessaire pour le récap jour par jour : une même personne
   * peut avoir plusieurs statuts manuels différents sur des sous-périodes
   * distinctes (ex: congé du 5 au 10, maladie du 15 au 18).
   */
  async findAllActifsPourPeriode(debut: Date, fin: Date): Promise<StatutManuel[]> {
    const debutStr = debut.toISOString().split('T')[0];
    const finStr = fin.toISOString().split('T')[0];

    return this.repo
      .createQueryBuilder('s')
      .where('s.dateDebut <= :finStr', { finStr })
      .andWhere('s.dateFin >= :debutStr', { debutStr })
      .getMany();
  }
}