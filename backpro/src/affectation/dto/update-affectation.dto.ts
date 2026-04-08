// src/affectation/dto/update-affectation.dto.ts

import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
  IsIn,  // Ajouter cette ligne
} from 'class-validator';
import { Type } from 'class-transformer';
import { PhaseHeuresDto } from './phase-heures.dto';

export class UpdateAffectationDto {
  @IsString()
  @IsOptional()
  ligne?: string;

  @IsBoolean()
  @IsOptional()
  estCapitaine?: boolean;

  // Ajouter ce champ
  @IsString()
  @IsOptional()
  @IsIn(['1ere poste', '2eme poste'], { message: 'Le poste doit être "1ere poste" ou "2eme poste"' })
  poste?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PhaseHeuresDto)
  @IsOptional()
  phases?: PhaseHeuresDto[];
}