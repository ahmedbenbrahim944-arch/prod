// src/stats/dto/get-stats-periode.dto.ts
import { IsString, IsDateString, IsOptional, IsIn } from 'class-validator';

export class GetStatsPeriodeDto {
  @IsString()
  @IsDateString()
  dateDebut: string;

  @IsString()
  @IsDateString()
  dateFin: string;

  @IsOptional()
  @IsString()
  @IsIn(['poste1', 'poste2'], { message: 'Le poste doit être "poste1" ou "poste2"' })
  poste?: string;
}