// src/matiere-premier/dto/update-matiere-premier.dto.ts
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateMatierePremierDto {
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'La ligne ne doit pas dépasser 50 caractères' })
  ligne?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'La référence matière première ne doit pas dépasser 50 caractères' })
  refMatierePremier?: string;
}