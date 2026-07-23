// src/phase/dto/create-phase.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePhaseDto {
  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  @MaxLength(50, { message: 'La ligne ne doit pas dépasser 50 caractères' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'La phase est obligatoire' })
  @MaxLength(10, { message: 'La phase ne doit pas dépasser 10 caractères' })
  phase: string;
}