// src/temps-sec/temps-sec.service.ts
import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException,
  NotFoundException,
  BadRequestException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TempsSec } from './entities/temps-sec.entity';
import { CreateTempsSecDto } from './dto/create-temps-sec.dto';
import { UpdateTempsSecDto } from './dto/update-temps-sec.dto';
import { UpdateTempsSecByRefDto } from './dto/update-temps-sec-by-ref.dto';

@Injectable()
export class TempsSecService {
  constructor(
    @InjectRepository(TempsSec)
    private tempsSecRepository: Repository<TempsSec>,
  ) {}

  /**
   * Créer un nouveau temps sec
   */
  async createTempsSec(createTempsSecDto: CreateTempsSecDto, adminId: number): Promise<TempsSec> {
    const { ligne, reference, seconde } = createTempsSecDto;

    // Vérifier si un temps avec la même ligne et référence existe déjà
    const existingTempsSec = await this.tempsSecRepository.findOne({ 
      where: { ligne, reference } 
    });
    
    if (existingTempsSec) {
      throw new ConflictException('Un temps avec cette ligne et référence existe déjà');
    }

    try {
      // Créer le nouveau temps sec
      const tempsSec = new TempsSec();
      tempsSec.ligne = ligne;
      tempsSec.reference = reference;
      tempsSec.seconde = seconde;

      return await this.tempsSecRepository.save(tempsSec);
    } catch (error) {
      console.error('Erreur création temps sec:', error);
      throw new InternalServerErrorException('Erreur lors de la création du temps sec');
    }
  }

  /**
   * Modifier un temps sec par ligne et référence
   */
  async updateByLigneAndReference(updateTempsSecByRefDto: UpdateTempsSecByRefDto): Promise<TempsSec> {
    const { ligne, reference, seconde } = updateTempsSecByRefDto;

    // Trouver le temps sec par ligne et référence
    const tempsSec = await this.tempsSecRepository.findOne({ 
      where: { ligne, reference } 
    });
    
    if (!tempsSec) {
      throw new NotFoundException(`Aucun temps trouvé pour la ligne "${ligne}" et référence "${reference}"`);
    }

    try {
      // Mettre à jour le temps
      tempsSec.seconde = seconde;
      
      return await this.tempsSecRepository.save(tempsSec);
    } catch (error) {
      console.error('Erreur modification temps sec:', error);
      throw new InternalServerErrorException('Erreur lors de la modification du temps sec');
    }
  }

  /**
   * Créer ou mettre à jour un temps sec (UPSERT)
   */
  async createOrUpdateTempsSec(createOrUpdateDto: CreateTempsSecDto, adminId: number): Promise<TempsSec> {
    const { ligne, reference, seconde } = createOrUpdateDto;

    // Vérifier si un temps avec la même ligne et référence existe déjà
    const existingTempsSec = await this.tempsSecRepository.findOne({ 
      where: { ligne, reference } 
    });

    try {
      if (existingTempsSec) {
        // Mettre à jour le temps existant
        existingTempsSec.seconde = seconde;
        return await this.tempsSecRepository.save(existingTempsSec);
      } else {
        // Créer un nouveau temps sec
        const tempsSec = new TempsSec();
        tempsSec.ligne = ligne;
        tempsSec.reference = reference;
        tempsSec.seconde = seconde;

        return await this.tempsSecRepository.save(tempsSec);
      }
    } catch (error) {
      console.error('Erreur création/mise à jour temps sec:', error);
      throw new InternalServerErrorException('Erreur lors de la création/mise à jour du temps sec');
    }
  }

  /**
   * Récupérer tous les temps sec
   */
  async findAll(): Promise<TempsSec[]> {
    return await this.tempsSecRepository.find({
      order: { ligne: 'ASC', reference: 'ASC' }
    });
  }

  /**
   * Récupérer les temps par ligne
   */
  async findByLigne(ligne: string): Promise<TempsSec[]> {
    return await this.tempsSecRepository.find({
      where: { ligne },
      order: { reference: 'ASC' }
    });
  }

  /**
   * Trouver un temps sec par ID
   */
  async findOne(id: number): Promise<TempsSec> {
    const tempsSec = await this.tempsSecRepository.findOne({ 
      where: { id } 
    });
    
    if (!tempsSec) {
      throw new NotFoundException(`Temps sec avec l'ID ${id} introuvable`);
    }
    
    return tempsSec;
  }

  /**
   * Trouver un temps sec par ligne et référence
   */
  async findByLigneAndReference(ligne: string, reference: string): Promise<TempsSec> {
    const tempsSec = await this.tempsSecRepository.findOne({ 
      where: { ligne, reference } 
    });
    
    if (!tempsSec) {
      throw new NotFoundException(`Temps sec avec ligne "${ligne}" et référence "${reference}" introuvable`);
    }
    
    return tempsSec;
  }

  /**
   * Mettre à jour un temps sec par ID
   */
  async update(id: number, updateTempsSecDto: UpdateTempsSecDto): Promise<TempsSec> {
    const tempsSec = await this.findOne(id);

    // Vérifier si la nouvelle combinaison ligne/référence existe déjà (si modifiée)
    if (updateTempsSecDto.ligne || updateTempsSecDto.reference) {
      const newLigne = updateTempsSecDto.ligne || tempsSec.ligne;
      const newReference = updateTempsSecDto.reference || tempsSec.reference;
      
      if (newLigne !== tempsSec.ligne || newReference !== tempsSec.reference) {
        const existingTempsSec = await this.tempsSecRepository.findOne({ 
          where: { ligne: newLigne, reference: newReference } 
        });
        
        if (existingTempsSec && existingTempsSec.id !== id) {
          throw new ConflictException('Un temps avec cette ligne et référence existe déjà');
        }
      }
    }

    // Mettre à jour les champs
    Object.assign(tempsSec, updateTempsSecDto);
    
    return await this.tempsSecRepository.save(tempsSec);
  }

  /**
   * Supprimer un temps sec
   */
  async remove(id: number): Promise<void> {
    const tempsSec = await this.findOne(id);
    await this.tempsSecRepository.remove(tempsSec);
  }

  /**
   * Supprimer un temps sec par ligne et référence
   */
  async removeByLigneAndReference(ligne: string, reference: string): Promise<void> {
    const tempsSec = await this.findByLigneAndReference(ligne, reference);
    await this.tempsSecRepository.remove(tempsSec);
  }
}