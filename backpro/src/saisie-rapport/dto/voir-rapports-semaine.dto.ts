// src/saisie-rapport/dto/voir-rapports-semaine.dto.ts

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VoirRapportsSemaineDto {
  @IsString()
  @IsNotEmpty({ message: 'La semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsOptional()
  jour?: string;

  @IsString()
  @IsOptional()
  ligne?: string;
}