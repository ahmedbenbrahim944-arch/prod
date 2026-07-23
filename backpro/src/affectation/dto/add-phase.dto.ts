// src/affectation/dto/add-phase.dto.ts
import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class AddPhaseDto {
  @IsString()
  @IsNotEmpty()
  phase: string;

  @IsNumber()
  @Min(0)
  heures: number;
}