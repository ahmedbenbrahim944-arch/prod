// src/ouvrier/dto/update-ouvrier.dto.ts
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateOuvrierDto {
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Le nom ne doit pas dépasser 50 caractères' })
  nom?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Le prénom ne doit pas dépasser 50 caractères' })
  prenom?: string;
}