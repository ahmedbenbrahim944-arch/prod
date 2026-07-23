// src/affectation/dto/phase-heures.dto.ts
import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class PhaseHeuresDto {
  @IsString()
  @IsNotEmpty()
  phase: string;

  @IsNumber()
  @Min(0)
  heures: number;
}