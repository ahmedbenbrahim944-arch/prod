// src/affectation/dto/create-affectation.dto.ts

import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  IsOptional,
  IsIn,  // Ajouter cette ligne
} from 'class-validator';
import { Type } from 'class-transformer';
import { PhaseHeuresDto } from './phase-heures.dto';

export class CreateAffectationDto {
  @IsNumber()
  @IsNotEmpty()
  matricule: number;

  @IsString()
  @IsNotEmpty()
  ligne: string;

  @IsBoolean()
  @IsOptional()
  estCapitaine?: boolean;

  // Ajouter ce champ
  @IsString()
  @IsNotEmpty()
  @IsIn(['1ere poste', '2eme poste'], { message: 'Le poste doit être "jour" ou "nuit"' })
  poste: string;

  @IsString()
  @IsOptional()
  bus?: string | null;  // ← nouveau : numéro de bus

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PhaseHeuresDto)
  phases: PhaseHeuresDto[];
}