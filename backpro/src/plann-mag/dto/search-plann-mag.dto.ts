// src/plann-mag/dto/search-plann-mag.dto.ts
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SearchPlannMagDto {
  @IsString()
  @IsNotEmpty()
  annee: string; // ex: "2026"

  @IsString()
  @IsNotEmpty()
  of: string; // ex: "1478"

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, { message: 'date doit être au format DDMM ex: 0104' })
  date: string; // ex: "0104" = 01 avril
}