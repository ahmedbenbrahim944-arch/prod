import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.type !== 'admin') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    const superAdminMatricules = ['1423']; // ✅ Votre matricule
    if (!superAdminMatricules.includes(user.nom)) {
      throw new ForbiddenException('Accès réservé au super administrateur');
    }

    return true;
  }
}