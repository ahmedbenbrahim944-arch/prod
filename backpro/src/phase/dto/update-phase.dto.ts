// src/phase/dto/update-phase.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdatePhaseDto {
  @IsString()
  @IsNotEmpty({ message: 'La phase est obligatoire' })
  @MaxLength(10, { message: 'La phase ne doit pas dépasser 10 caractères' })
  phase: string;
}