// src/stats/dto/get-stats-annuel.dto.ts
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class GetStatsAnnuelDto {
  @IsString()
  @IsNotEmpty({ message: 'La date est obligatoire' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Le format de date doit être YYYY-MM-DD (ex: 2026-01-15)'
  })
  date: string;
}
