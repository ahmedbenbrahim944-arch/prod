// src/stats/dto/get-stats-selection.dto.ts
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class GetStatsSelectionDto {
  @IsNotEmpty({ message: 'La date de début est obligatoire' })
  @IsString()
  @Matches(DATE_REGEX, { message: 'Le format de dateDebut doit être YYYY-MM-DD' })
  dateDebut: string;

  @IsNotEmpty({ message: 'La date de fin est obligatoire' })
  @IsString()
  @Matches(DATE_REGEX, { message: 'Le format de dateFin doit être YYYY-MM-DD' })
  dateFin: string;
}