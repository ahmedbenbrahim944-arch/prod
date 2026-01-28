// src/phase/phase.service.ts
import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException,
  NotFoundException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Phase } from './entities/phase.entity';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';

@Injectable()
export class PhaseService {
  constructor(
    @InjectRepository(Phase)
    private phaseRepository: Repository<Phase>,
  ) {}

  /**
   * Créer une nouvelle phase
   */
  async createPhase(createPhaseDto: CreatePhaseDto): Promise<Phase> {
    const { ligne, phase } = createPhaseDto;

    // Vérifier si une phase avec la même ligne et même phase existe déjà
    const existingPhase = await this.phaseRepository.findOne({ 
      where: { ligne, phase } 
    });
    
    if (existingPhase) {
      throw new ConflictException('Une phase avec cette ligne et ce numéro existe déjà');
    }

    try {
      // Créer la nouvelle phase
      const newPhase = new Phase();
      newPhase.ligne = ligne;
      newPhase.phase = phase;

      return await this.phaseRepository.save(newPhase);
    } catch (error) {
      console.error('Erreur création phase:', error);
      throw new InternalServerErrorException('Erreur lors de la création de la phase');
    }
  }

  /**
   * Récupérer toutes les phases
   */
  async findAll(): Promise<Phase[]> {
    return await this.phaseRepository.find({
      order: { ligne: 'ASC', phase: 'ASC' }
    });
  }

  /**
   * Trouver les phases par ligne
   */
  async findByLigne(ligne: string): Promise<Phase[]> {
    return await this.phaseRepository.find({ 
      where: { ligne },
      order: { phase: 'ASC' }
    });
  }

  /**
   * Trouver une phase par ID
   */
  async findOne(id: number): Promise<Phase> {
    const phase = await this.phaseRepository.findOne({ 
      where: { id } 
    });
    
    if (!phase) {
      throw new NotFoundException(`Phase avec l'ID ${id} introuvable`);
    }
    
    return phase;
  }

  /**
   * Trouver une phase spécifique par ligne et phase
   */
  async findOneByLigneAndPhase(ligne: string, phaseNum: string): Promise<Phase> {
    const phase = await this.phaseRepository.findOne({ 
      where: { ligne, phase: phaseNum } 
    });
    
    if (!phase) {
      throw new NotFoundException(`Phase "${phaseNum}" pour la ligne "${ligne}" introuvable`);
    }
    
    return phase;
  }

  /**
   * Modifier une phase par ID
   */
  async update(id: number, updatePhaseDto: UpdatePhaseDto): Promise<Phase> {
    const phase = await this.findOne(id);

    try {
      // Mettre à jour la phase
      phase.phase = updatePhaseDto.phase;
      
      return await this.phaseRepository.save(phase);
    } catch (error) {
      console.error('Erreur modification phase:', error);
      throw new InternalServerErrorException('Erreur lors de la modification de la phase');
    }
  }

  /**
   * Supprimer une phase par ID
   */
  async remove(id: number): Promise<void> {
    const phase = await this.findOne(id);
    await this.phaseRepository.remove(phase);
  }

  /**
   * Supprimer une phase par ligne et numéro de phase
   */
  async removeByLigneAndPhase(ligne: string, phaseNum: string): Promise<void> {
    const phase = await this.findOneByLigneAndPhase(ligne, phaseNum);
    await this.phaseRepository.remove(phase);
  }

  /**
   * Récupérer toutes les lignes distinctes
   */
  async findAllLignes(): Promise<string[]> {
    const phases = await this.phaseRepository
      .createQueryBuilder('phase')
      .select('DISTINCT phase.ligne', 'ligne')
      .orderBy('ligne', 'ASC')
      .getRawMany();
    
    return phases.map(p => p.ligne);
  }
}