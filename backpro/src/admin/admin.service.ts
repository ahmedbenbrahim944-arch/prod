// src/admin/admin.service.ts
import { 
  Injectable, 
  ConflictException, 
  InternalServerErrorException,
  NotFoundException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  /**
   * Créer un nouvel administrateur
   */
  async createAdmin(createAdminDto: CreateAdminDto): Promise<Admin> {
    const { nom, prenom, password } = createAdminDto;

    // Vérifier si un admin avec le même nom existe déjà
    const existingAdmin = await this.adminRepository.findOne({ 
      where: { nom } 
    });
    
    if (existingAdmin) {
      throw new ConflictException('Un admin avec ce nom existe déjà');
    }

    try {
      // Hasher le mot de passe avec bcrypt (10 rounds)
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Créer le nouvel admin
      const admin = this.adminRepository.create({
        nom,
        prenom,
        password: hashedPassword,
      });

      return await this.adminRepository.save(admin);
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de la création de l\'admin');
    }
  }

  /**
   * Récupérer tous les admins
   */
  async findAll(): Promise<Admin[]> {
    return await this.adminRepository.find({
      select: ['id', 'nom', 'prenom', 'isActive', 'createdAt', 'updatedAt']
    });
  }

  /**
   * Trouver un admin par ID
   */
  async findOneById(id: number): Promise<Admin> { // Changé de Admin | null à Admin
    const admin = await this.adminRepository.findOne({ where: { id } });
    
    if (!admin) {
      throw new NotFoundException(`Admin avec l'ID ${id} introuvable`);
    }
    
    return admin;
  }

  /**
   * Trouver un admin par nom (pour login)
   */
  async findOneByNom(nom: string): Promise<Admin | null> {
    return await this.adminRepository.findOne({ where: { nom } });
  }

  /**
   * Activer/Désactiver un admin
   */
  async toggleActive(id: number): Promise<Admin> {
    const admin = await this.findOneById(id); // Déjà vérifié dans findOneById()
    admin.isActive = !admin.isActive;
    return await this.adminRepository.save(admin);
  }

  /**
   * Supprimer un admin
   */
  async remove(id: number): Promise<void> {
    const admin = await this.findOneById(id); // Déjà vérifié dans findOneById()
    await this.adminRepository.remove(admin);
  }
}