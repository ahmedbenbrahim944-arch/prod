// src/production/dto/search-production.dto.ts
import { IsString, IsOptional, IsDateString, IsInt } from 'class-validator';

export class SearchProductionDto {
  @IsString()
  @IsOptional()
  ligne?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsDateString()
  @IsOptional()
  dateDebut?: string;

  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @IsInt()
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @IsOptional()
  limit?: number = 50;
}