// src/stats/dto/get-stats-semaine.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class GetStatsSemaineDto {
  @IsString()
  @IsNotEmpty({ message: 'La semaine est obligatoire' })
  semaine: string;

  @IsOptional()
  @IsString()
  @IsIn(['poste1', 'poste2'], { message: 'Le poste doit être "poste1" ou "poste2"' })
  poste?: string;
}