// src/statut/dto/create-statut.dto.ts
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, IsDateString } from 'class-validator';

export class CreateStatutDto {
  @IsNumber()
  @IsNotEmpty({ message: 'Le matricule est obligatoire' })
  matricule: number;

  @IsDateString()
  @IsNotEmpty({ message: 'La date est obligatoire (format: YYYY-MM-DD)' })
  date: string;

  @IsEnum(['P', 'AB', 'S', 'C'], { 
    message: 'Le statut doit être: P (Présent), AB (Absent), S (Sélection), ou C (Congé)' 
  })
  @IsNotEmpty({ message: 'Le statut est obligatoire' })
  statut: 'P' | 'AB' | 'S' | 'C';

  @IsString()
  @IsOptional()
  commentaire?: string;
}