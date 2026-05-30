// src/stats/dto/get-stats-lignes.dto.ts
import { IsString, IsOptional, IsIn } from 'class-validator';

export class GetStatsLignesDto {
  @IsString()
  semaine: string;

  @IsOptional()
  @IsString()
  @IsIn(['poste1', 'poste2'], { message: 'Le poste doit être "poste1" ou "poste2"' })
  poste?: string;
}