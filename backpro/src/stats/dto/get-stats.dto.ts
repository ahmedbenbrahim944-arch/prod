// src/stats/dto/get-stats.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GetStatsDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string;
}