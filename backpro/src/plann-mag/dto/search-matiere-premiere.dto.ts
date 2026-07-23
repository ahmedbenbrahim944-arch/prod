// src/plann-mag/dto/search-matiere-premiere.dto.ts
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SearchMatierePremiereDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ligne?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceLigne?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refMp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}