// src/admin/dto/login-admin.dto.ts
import { IsString, IsNotEmpty, MinLength, MaxLength, IsNumberString } from 'class-validator';

export class LoginAdminDto {
  @IsNumberString({}, { message: 'Le nom doit être un nombre' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MinLength(4, { message: 'Le nom doit contenir au moins 4 chiffres' })
  @MaxLength(10, { message: 'Le nom ne doit pas dépasser 10 chiffres' })
  nom: string;

  @IsNumberString({}, { message: 'Le mot de passe doit être un nombre' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @MinLength(4, { message: 'Le mot de passe doit contenir au moins 4 chiffres' })
  @MaxLength(10, { message: 'Le mot de passe ne doit pas dépasser 10 chiffres' })
  password: string;
}