import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminService } from '../admin/admin.service';
import { UserService } from '../user/user.service';
import { TrackingService } from '../tracking/tracking.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginAdminDto } from '../admin/dto/login-admin.dto';
import { LoginUserDto } from '../user/dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private adminService: AdminService,
    private userService: UserService,
    private jwtService: JwtService,
    private trackingService: TrackingService,
  ) {}

  async validateAdmin(loginAdminDto: LoginAdminDto): Promise<any> {
    const { nom, password } = loginAdminDto;
    const admin = await this.adminService.findOneByNom(nom);
    if (!admin) throw new UnauthorizedException('Nom ou mot de passe incorrect');
    if (!admin.isActive) throw new UnauthorizedException('Compte désactivé');
    
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) throw new UnauthorizedException('Nom ou mot de passe incorrect');

    const { password: _, ...result } = admin;
    return result;
  }

  async validateUser(loginUserDto: LoginUserDto): Promise<any> {
    const { nom, password } = loginUserDto;
    const user = await this.userService.findOneByNom(nom);
    if (!user) throw new UnauthorizedException('Nom ou mot de passe incorrect');
    if (!user.isActive) throw new UnauthorizedException('Compte désactivé');
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Nom ou mot de passe incorrect');

    const { password: _, ...result } = user;
    return result;
  }

  async loginAdmin(loginAdminDto: LoginAdminDto, req?: any) {
    const admin = await this.validateAdmin(loginAdminDto);
    
    const payload: JwtPayload = {
      id: admin.id,
      nom: admin.nom,
      type: 'admin',
    };

    // Tracking sans bloquer l'application
    if (req) {
      const ip = (req.headers['x-forwarded-for'] || 
                  req.connection?.remoteAddress || 
                  req.socket?.remoteAddress || 
                  'unknown').toString();
      
      this.trackingService.track({
        matricule: admin.nom,
        userType: 'admin',
        adminId: admin.id,
        actionType: 'LOGIN',
        url: req.url || '/auth/admin/login',
        method: 'POST',
        statusCode: 200,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      }).catch(() => {});
    }

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

  async loginUser(loginUserDto: LoginUserDto, req?: any) {
    const user = await this.validateUser(loginUserDto);
    
    const payload: JwtPayload = {
      id: user.id,
      nom: user.nom,
      type: 'user',
    };

    if (req) {
      const ip = (req.headers['x-forwarded-for'] || 
                  req.connection?.remoteAddress || 
                  req.socket?.remoteAddress || 
                  'unknown').toString();
      
      this.trackingService.track({
        matricule: user.nom,
        userType: 'user',
        userId: user.id,
        actionType: 'LOGIN',
        url: req.url || '/auth/user/login',
        method: 'POST',
        statusCode: 200,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      }).catch(() => {});
    }

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

  async verifyPayload(payload: JwtPayload): Promise<any> {
    if (payload.type === 'admin') {
      return await this.adminService.findOneById(payload.id);
    } else if (payload.type === 'user') {
      return await this.userService.findOne(payload.id);
    }
    throw new UnauthorizedException('Type d\'utilisateur invalide');
  }
}