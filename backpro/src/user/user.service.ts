// src/user/user.service.ts
import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException,
  NotFoundException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Créer un nouveau user (Chef Secteur) - Seulement par l'admin
   */
  async createUser(createUserDto: CreateUserDto, adminId: number): Promise<User> {
    const { nom, prenom, password } = createUserDto;

    // Vérifier si un user avec le même nom existe déjà
    const existingUser = await this.userRepository.findOne({ 
      where: { nom } 
    });
    
    if (existingUser) {
      throw new ConflictException('Un chef secteur avec ce nom existe déjà');
    }

    try {
      // Hasher le mot de passe avec bcrypt (10 rounds)
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Créer le nouveau user avec l'ID de l'admin qui l'a créé
      const user = this.userRepository.create({
        nom,
        prenom,
        password: hashedPassword,
        createdById: adminId, // L'admin qui crée ce user
      });

      return await this.userRepository.save(user);
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de la création du chef secteur');
    }
  }

  /**
   * Récupérer tous les users
   */
  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      select: ['id', 'nom', 'prenom', 'isActive', 'createdAt', 'updatedAt'],
      relations: ['createdBy'],
    });
  }

  /**
   * Trouver un user par ID
   */
  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ 
      where: { id },
      relations: ['createdBy']
    });
    
    if (!user) {
      throw new NotFoundException(`Chef secteur avec l'ID ${id} introuvable`);
    }
    
    return user;
  }

  /**
   * Trouver un user par nom (pour login)
   */
  async findOneByNom(nom: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { nom } });
  }

  /**
   * Mettre à jour un user
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id); // Déjà vérifié dans findOne()

    // Si on change le mot de passe, le hasher
    if (updateUserDto.password) {
      const saltRounds = 10;
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    // Mettre à jour les champs - user n'est jamais null ici
    Object.assign(user, updateUserDto);
    
    return await this.userRepository.save(user);
  }

  /**
   * Activer/Désactiver un user
   */
  async toggleActive(id: number): Promise<User> {
    const user = await this.findOne(id); // Déjà vérifié dans findOne()
    user.isActive = !user.isActive;
    return await this.userRepository.save(user);
  }

  /**
   * Supprimer un user
   */
  async remove(id: number): Promise<void> {
    const user = await this.findOne(id); // Déjà vérifié dans findOne()
    await this.userRepository.remove(user);
  }
}