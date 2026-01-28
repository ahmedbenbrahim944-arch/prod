// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminService } from '../admin/admin.service';
import { UserService } from '../user/user.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginAdminDto } from '../admin/dto/login-admin.dto';
import { LoginUserDto } from '../user/dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private adminService: AdminService,
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validation Admin
   */
  async validateAdmin(loginAdminDto: LoginAdminDto): Promise<any> {
    const { nom, password } = loginAdminDto;

    // Trouver l'admin par nom
    const admin = await this.adminService.findOneByNom(nom);
    if (!admin) {
      throw new UnauthorizedException('Nom ou mot de passe incorrect');
    }

    // Vérifier si le compte est actif
    if (!admin.isActive) {
      throw new UnauthorizedException('Votre compte est désactivé');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Nom ou mot de passe incorrect');
    }

    // Retourner les infos sans le password
    const { password: _, ...result } = admin;
    return result;
  }

  /**
   * Validation User (Chef Secteur)
   */
  async validateUser(loginUserDto: LoginUserDto): Promise<any> {
    const { nom, password } = loginUserDto;

    // Trouver le user par nom
    const user = await this.userService.findOneByNom(nom);
    if (!user) {
      throw new UnauthorizedException('Nom ou mot de passe incorrect');
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte est désactivé');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Nom ou mot de passe incorrect');
    }

    // Retourner les infos sans le password
    const { password: _, ...result } = user;
    return result;
  }

  /**
   * Login Admin
   */
  async loginAdmin(loginAdminDto: LoginAdminDto) {
    const admin = await this.validateAdmin(loginAdminDto);
    
    const payload: JwtPayload = {
      id: admin.id,
      nom: admin.nom,
      type: 'admin',
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: admin.id,
        nom: admin.nom,
        prenom: admin.prenom,
        type: 'admin',
      },
    };
  }

  /**
   * Login User (Chef Secteur)
   */
  async loginUser(loginUserDto: LoginUserDto) {
    const user = await this.validateUser(loginUserDto);
    
    const payload: JwtPayload = {
      id: user.id,
      nom: user.nom,
      type: 'user',
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        type: 'user',
      },
    };
  }

  /**
   * Vérification du token JWT
   */
  async verifyPayload(payload: JwtPayload): Promise<any> {
    if (payload.type === 'admin') {
      return await this.adminService.findOneById(payload.id);
    } else if (payload.type === 'user') {
      return await this.userService.findOne(payload.id);
    }
    throw new UnauthorizedException('Type d\'utilisateur invalide');
  }
}