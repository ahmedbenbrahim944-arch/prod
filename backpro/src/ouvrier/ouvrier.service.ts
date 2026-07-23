// src/ouvrier/ouvrier.service.ts
import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException,
  NotFoundException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ouvrier } from './entities/ouvrier.entity';
import { CreateOuvrierDto } from './dto/create-ouvrier.dto';
import { SearchOuvrierDto } from './dto/search-ouvrier.dto';

@Injectable()
export class OuvrierService {
  constructor(
    @InjectRepository(Ouvrier)
    private ouvrierRepository: Repository<Ouvrier>,
  ) {}

  /**
   * Créer un nouvel ouvrier
   */
  async createOuvrier(createOuvrierDto: CreateOuvrierDto): Promise<Ouvrier> {
    const { matricule, nomPrenom } = createOuvrierDto;

    // Vérifier si un ouvrier avec le même matricule existe déjà
    const existingOuvrier = await this.ouvrierRepository.findOne({ 
      where: { matricule } 
    });
    
    if (existingOuvrier) {
      throw new ConflictException('Un ouvrier avec ce matricule existe déjà');
    }

    try {
      // Création manuelle de l'instance
      const ouvrier = new Ouvrier();
      ouvrier.matricule = matricule;
      ouvrier.nomPrenom = nomPrenom;

      return await this.ouvrierRepository.save(ouvrier);
    } catch (error) {
      console.error('Erreur création ouvrier:', error);
      throw new InternalServerErrorException('Erreur lors de la création de l\'ouvrier');
    }
  }

  /**
   * Récupérer tous les ouvriers
   */
  async findAll(): Promise<Ouvrier[]> {
    return await this.ouvrierRepository.find({
      order: { matricule: 'ASC' }
    });
  }

  /**
   * Trouver un ouvrier par matricule
   */
  async findOneByMatricule(matricule: number): Promise<Ouvrier> {
    const ouvrier = await this.ouvrierRepository.findOne({ 
      where: { matricule } 
    });
    
    if (!ouvrier) {
      throw new NotFoundException(`Ouvrier avec le matricule ${matricule} introuvable`);
    }
    
    return ouvrier;
  }

  /**
   * Rechercher un ouvrier par matricule (via body)
   */
  async searchByMatricule(searchOuvrierDto: SearchOuvrierDto): Promise<{ matricule: number; nomPrenom: string }> {
    const { matricule } = searchOuvrierDto;
    const ouvrier = await this.findOneByMatricule(matricule);
    
    return {
      matricule: ouvrier.matricule,
      nomPrenom: ouvrier.nomPrenom
    };
  }

  /**
   * Supprimer un ouvrier
   */
  async remove(matricule: number): Promise<void> {
    const ouvrier = await this.findOneByMatricule(matricule);
    await this.ouvrierRepository.remove(ouvrier);
  }
}