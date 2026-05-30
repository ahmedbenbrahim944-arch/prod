// src/semaine/dto/update-planification-by-criteria.dto.ts
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdatePlanificationByCriteriaDto {
  @IsString()
  semaine: string;

  @IsString()
  @IsOptional()
  jour?: string;

  @IsString()
  ligne: string;

  @IsString()
  reference: string;

  @IsString()
  @IsOptional()
  poste?: string; // ✅ DOIT ÊTRE PRÉSENT

  @IsString()
  @IsOptional()
  of?: string;

  @IsNumber()
  @IsOptional()
  qtePlanifiee?: number;

  @IsNumber()
  @IsOptional()
  qteModifiee?: number;

  @IsNumber()
  @IsOptional()
  nbOperateurs?: number;

  @IsNumber()
  @IsOptional()
  decProduction?: number;

  @IsNumber()
  @IsOptional()
  decMagasin?: number;

  @IsString()
  @IsOptional()
  note?: string;
}