// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  id: number;
  nom: string;
  type: 'admin' | 'user'; // Pour distinguer admin/user
}