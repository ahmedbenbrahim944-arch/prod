// src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtConstants } from '../constants';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.verifyPayload(payload);
    
    if (!user) {
      throw new UnauthorizedException('Token invalide ou utilisateur non trouvé');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte est désactivé');
    }

    return {
      id: user.id,
      nom: user.nom,
      type: payload.type,
    };
  }
}