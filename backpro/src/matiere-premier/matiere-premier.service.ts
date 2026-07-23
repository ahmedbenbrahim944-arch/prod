// src/matiere-premier/matiere-premier.service.ts
import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException,
  NotFoundException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatierePremier } from './entities/matiere-premier.entity';
import { CreateMatierePremierDto } from './dto/create-matiere-premier.dto';
import { UpdateMatierePremierDto } from './dto/update-matiere-premier.dto';

@Injectable()
export class MatierePremierService {
  constructor(
    @InjectRepository(MatierePremier)
    private matierePremierRepository: Repository<MatierePremier>,
  ) {}

  /**
   * Créer une nouvelle matière première
   */
  async createMatierePremier(createMatierePremierDto: CreateMatierePremierDto): Promise<MatierePremier> {
    const { ligne, refMatierePremier } = createMatierePremierDto;

    // Vérifier si une matière première avec la même ligne et même référence existe déjà
    const existingMatierePremier = await this.matierePremierRepository.findOne({ 
      where: { ligne, refMatierePremier } 
    });
    
    if (existingMatierePremier) {
      throw new ConflictException('Une matière première avec cette ligne et cette référence existe déjà');
    }

    try {
      // Créer la nouvelle matière première
      const matierePremier = new MatierePremier();
      matierePremier.ligne = ligne;
      matierePremier.refMatierePremier = refMatierePremier;

      return await this.matierePremierRepository.save(matierePremier);
    } catch (error) {
      console.error('Erreur création matière première:', error);
      throw new InternalServerErrorException('Erreur lors de la création de la matière première');
    }
  }

  /**
   * Récupérer toutes les matières premières
   */
  async findAll(): Promise<MatierePremier[]> {
    return await this.matierePremierRepository.find({
      order: { ligne: 'ASC', refMatierePremier: 'ASC' }
    });
  }

  /**
   * Trouver les matières premières par ligne
   */
  async findByLigne(ligne: string): Promise<MatierePremier[]> {
    return await this.matierePremierRepository.find({ 
      where: { ligne },
      order: { refMatierePremier: 'ASC' }
    });
  }

  /**
   * Trouver une matière première par ID
   */
  async findOne(id: number): Promise<MatierePremier> {
    const matierePremier = await this.matierePremierRepository.findOne({ 
      where: { id } 
    });
    
    if (!matierePremier) {
      throw new NotFoundException(`Matière première avec l'ID ${id} introuvable`);
    }
    
    return matierePremier;
  }

  /**
   * Trouver une matière première spécifique par ligne et référence
   */
  async findOneByLigneAndRef(ligne: string, refMatierePremier: string): Promise<MatierePremier> {
    const matierePremier = await this.matierePremierRepository.findOne({ 
      where: { ligne, refMatierePremier } 
    });
    
    if (!matierePremier) {
      throw new NotFoundException(`Matière première "${refMatierePremier}" pour la ligne "${ligne}" introuvable`);
    }
    
    return matierePremier;
  }

  /**
   * Modifier une matière première par ID
   */
  async update(id: number, updateMatierePremierDto: UpdateMatierePremierDto): Promise<MatierePremier> {
    const matierePremier = await this.findOne(id);

    try {
      // Mettre à jour les champs
      if (updateMatierePremierDto.ligne !== undefined) {
        matierePremier.ligne = updateMatierePremierDto.ligne;
      }
      if (updateMatierePremierDto.refMatierePremier !== undefined) {
        matierePremier.refMatierePremier = updateMatierePremierDto.refMatierePremier;
      }
      
      return await this.matierePremierRepository.save(matierePremier);
    } catch (error) {
      console.error('Erreur modification matière première:', error);
      throw new InternalServerErrorException('Erreur lors de la modification de la matière première');
    }
  }

  /**
   * Supprimer une matière première par ID
   */
  async remove(id: number): Promise<void> {
    const matierePremier = await this.findOne(id);
    await this.matierePremierRepository.remove(matierePremier);
  }

  /**
   * Supprimer une matière première par ligne et référence
   */
  async removeByLigneAndRef(ligne: string, refMatierePremier: string): Promise<void> {
    const matierePremier = await this.findOneByLigneAndRef(ligne, refMatierePremier);
    await this.matierePremierRepository.remove(matierePremier);
  }

  /**
   * Récupérer toutes les lignes distinctes
   */
  async findAllLignes(): Promise<string[]> {
    const matieresPremieres = await this.matierePremierRepository
      .createQueryBuilder('matiere_premier')
      .select('DISTINCT matiere_premier.ligne', 'ligne')
      .orderBy('ligne', 'ASC')
      .getRawMany();
    
    return matieresPremieres.map(mp => mp.ligne);
  }

  /**
   * Récupérer toutes les références matière première distinctes
   */
  async findAllRefMatierePremier(): Promise<string[]> {
    const matieresPremieres = await this.matierePremierRepository
      .createQueryBuilder('matiere_premier')
      .select('DISTINCT matiere_premier.refMatierePremier', 'refMatierePremier')
      .orderBy('refMatierePremier', 'ASC')
      .getRawMany();
    
    return matieresPremieres.map(mp => mp.refMatierePremier);
  }
}