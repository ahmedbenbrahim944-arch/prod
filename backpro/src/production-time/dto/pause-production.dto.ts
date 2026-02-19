import { IsNotEmpty, IsString, IsIn, IsOptional, IsArray } from 'class-validator';

export class PauseProductionDto {
  @IsNotEmpty()
  sessionId: number;

  @IsNotEmpty()
  @IsIn(['M1', 'M2', 'M3', 'M4', 'M5', 'M6'])
  mCategory: string;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  // ✅ NOUVEAUX CHAMPS pour M1, M4, M5
  
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matierePremierRefs?: string[]; // Pour M1 - Références matières premières

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productRefs?: string[]; // Pour M5 - Références produits

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phasesEnPanne?: string[]; // Pour M4 - Phases en panne
}