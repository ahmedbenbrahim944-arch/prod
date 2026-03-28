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
  estCapitaine?: boolean; // Ajout : optionnel, par défaut false

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PhaseHeuresDto)
  phases: PhaseHeuresDto[];
}