// src/auth/constants.ts
export const jwtConstants = {
  secret: 'votre_cle_secrete_jwt_tres_longue_et_complexe',
  expiresIn: '24h' as any, // Force le type si nécessaire
};