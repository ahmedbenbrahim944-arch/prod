// src/stats/dto/get-stats.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class GetStatsDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string;

  @IsOptional()
  @IsString()
  @IsIn(['poste1', 'poste2'], { message: 'Le poste doit être "poste1" ou "poste2"' })
  poste?: string;
}