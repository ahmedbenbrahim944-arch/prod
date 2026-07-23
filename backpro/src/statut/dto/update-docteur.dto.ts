// src/statut/dto/update-docteur.dto.ts
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class UpdateDocteurDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nomDocteur: string;
}