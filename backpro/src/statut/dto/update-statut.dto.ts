// src/statut/dto/update-statut.dto.ts
import { IsString, IsNotEmpty, Matches, IsIn,IsOptional } from 'class-validator';

export class UpdateStatutDto {
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
  nomPrenom: string;

  @IsString()
  @IsOptional()
  commentaire?: string;
}

