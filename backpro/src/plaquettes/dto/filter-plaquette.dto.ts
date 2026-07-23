// src/plaquettes/dto/filter-plaquette.dto.ts
import { IsOptional, IsString, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterPlaquetteDto {
  // Filtrer par date exacte (format: YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  date?: string;

  // Filtrer par semaine (id)
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  semaineId?: number;

  // Filtrer par nom de semaine (ex: "semaine1")
  @IsOptional()
  @IsString()
  semaine?: string;

  // Filtrer par ligne
  @IsOptional()
  @IsString()
  ligne?: string;
}