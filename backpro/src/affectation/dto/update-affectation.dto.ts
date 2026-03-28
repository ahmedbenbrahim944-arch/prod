// src/affectation/dto/update-affectation.dto.ts
import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PhaseHeuresDto } from './phase-heures.dto';

export class UpdateAffectationDto {
  @IsString()
  @IsOptional()
  ligne?: string;

  @IsBoolean()
  @IsOptional()
  estCapitaine?: boolean; // Ajout : permettre de changer le statut capitaine

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PhaseHeuresDto)
  @IsOptional()
  phases?: PhaseHeuresDto[];
}