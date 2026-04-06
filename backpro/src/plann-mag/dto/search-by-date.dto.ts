// src/plann-mag/dto/search-by-date.dto.ts
import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class SearchByDateDto {
  @IsString()
  @IsNotEmpty()
  annee: string; // ex: "2026"

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, { message: 'date doit être au format DDMM ex: 0204' })
  date: string; // ex: "0204" = 02 avril

  @IsString()
  @IsOptional()
  of?: string; // filtre optionnel — si absent, retourne TOUS les OFs de la date
}