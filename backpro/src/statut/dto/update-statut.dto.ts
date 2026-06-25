// src/statut/dto/update-statut.dto.ts
import { IsString, IsNotEmpty, Matches, IsIn, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateStatutDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Le matricule doit être un nombre' })
  @IsNotEmpty({ message: 'Le matricule est obligatoire' })
  matricule: number;

  @IsString()
  @IsNotEmpty({ message: 'La date est obligatoire' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format de date doit être YYYY-MM-DD'
  })
  date: string;

  @IsString()
  @IsIn(['AB', 'C', 'S'], {
    message: 'Le statut doit être AB (Absent), C (Congé) ou S (Sélection)'
  })
  statut: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom et prénom est obligatoire' })
  nomPrenom: string;

  @IsString()
  @IsOptional()
  commentaire?: string;

  @IsString()
  @IsOptional()
  nomDocteur?: string;
}