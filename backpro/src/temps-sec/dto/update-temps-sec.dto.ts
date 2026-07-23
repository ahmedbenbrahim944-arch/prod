// src/temps-sec/dto/update-temps-sec.dto.ts
import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';

export class UpdateTempsSecDto {
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'La ligne ne doit pas dépasser 50 caractères' })
  ligne?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'La référence ne doit pas dépasser 50 caractères' })
  reference?: string;

  @IsNumber({}, { message: 'Le temps en secondes doit être un nombre' })
  @IsOptional()
  @Min(1, { message: 'Le temps en secondes doit être au moins 1' })
  seconde?: number;
}