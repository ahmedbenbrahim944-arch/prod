// src/affectation/dto/nommer-capitaine.dto.ts
import { IsNotEmpty, IsNumber } from 'class-validator';

export class NommerCapitaineDto {
  @IsNumber()
  @IsNotEmpty()
  matricule: number;
}