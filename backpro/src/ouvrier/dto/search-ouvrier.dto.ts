// src/ouvrier/dto/search-ouvrier.dto.ts
import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class SearchOuvrierDto {
  @IsNumber({}, { message: 'Le matricule doit être un nombre' })
  @IsNotEmpty({ message: 'Le matricule est obligatoire' })
  @Min(1, { message: 'Le matricule doit être au moins 1' })
  @Max(999999, { message: 'Le matricule ne doit pas dépasser 999999' })
  matricule: number;
}