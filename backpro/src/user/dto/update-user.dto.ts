// src/user/dto/update-user.dto.ts
import { IsString, MinLength, MaxLength, IsOptional, IsBoolean, Matches, IsNumberString } from 'class-validator';

export class UpdateUserDto {
  @IsNumberString({}, { message: 'Le nom doit être un nombre' })
  @IsOptional()
  @MinLength(4, { message: 'Le nom doit contenir au moins 4 chiffres' })
  @MaxLength(10, { message: 'Le nom ne doit pas dépasser 10 chiffres' })
  nom?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Le prénom ne doit pas dépasser 50 caractères' })
  prenom?: string;

  @IsNumberString({}, { message: 'Le mot de passe doit être un nombre' })
  @IsOptional()
  @MinLength(4, { message: 'Le mot de passe doit contenir au moins 4 chiffres' })
  @MaxLength(10, { message: 'Le mot de passe ne doit pas dépasser 10 chiffres' })
  password?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}