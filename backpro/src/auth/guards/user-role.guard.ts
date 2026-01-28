// src/auth/guards/user-role.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class UserRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.type !== 'user') {
      throw new ForbiddenException('Accès réservé aux chefs secteur');
    }

    return true;
  }
}