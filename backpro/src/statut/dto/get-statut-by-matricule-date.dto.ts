// src/statut/dto/get-statut-by-matricule-date.dto.ts
import { IsNotEmpty, IsNumber, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class GetStatutByMatriculeDateDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Le matricule doit être un nombre' })
  @IsNotEmpty({ message: 'Le matricule est obligatoire' })
  matricule: number;

  @IsNotEmpty({ message: 'La date est obligatoire' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format de date doit être YYYY-MM-DD',
  })
  date: string;
}