// src/plaquettes/dto/get-stats.dto.ts
import { IsDateString, IsNotEmpty } from 'class-validator';

export class GetStatsDto {
  @IsDateString()
  @IsNotEmpty()
  dateDebut: string;

  @IsDateString()
  @IsNotEmpty()
  dateFin: string;
}