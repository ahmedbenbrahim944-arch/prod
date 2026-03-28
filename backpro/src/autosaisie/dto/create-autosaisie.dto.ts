// src/autosaisie/dto/create-autosaisie.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PhaseHeureDto {
  @IsString()
  @IsNotEmpty()
  phase: string;

  @IsNumber()
  heures: number;
}

export class CreateAutosaisieDto {
  @IsString()
  @IsNotEmpty()
  n_badget: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PhaseHeureDto)
  phases?: PhaseHeureDto[];
}