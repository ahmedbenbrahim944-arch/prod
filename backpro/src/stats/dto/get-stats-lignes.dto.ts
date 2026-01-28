// src/stats/dto/get-stats-lignes.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class GetStatsLignesDto {
 
  
  @IsString()
  semaine: string;
}