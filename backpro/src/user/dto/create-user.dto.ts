// src/user/dto/create-user.dto.ts
import { IsString, MinLength, MaxLength, IsNotEmpty, Matches, IsNumberString } from 'class-validator';

export class CreateUserDto {
  @IsNumberString({}, { message: 'Le nom doit être un nombre' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MinLength(4, { message: 'Le nom doit contenir au moins 4 chiffres' })
  @MaxLength(10, { message: 'Le nom ne doit pas dépasser 10 chiffres' })
  nom: string;

  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @MaxLength(50, { message: 'Le prénom ne doit pas dépasser 50 caractères' })
  prenom: string;

  @IsNumberString({}, { message: 'Le mot de passe doit être un nombre' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @MinLength(4, { message: 'Le mot de passe doit contenir au moins 4 chiffres' })
  @MaxLength(10, { message: 'Le mot de passe ne doit pas dépasser 10 chiffres' })
  password: string;
}