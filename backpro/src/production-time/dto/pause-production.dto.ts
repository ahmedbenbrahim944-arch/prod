// dto/pause-production.dto.ts
import { IsNotEmpty, IsString, IsIn, IsOptional, IsArray, IsNumber } from 'class-validator';

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

  // ✅ Références métier M1, M4, M5
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matierePremierRefs?: string[]; // Pour M1

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productRefs?: string[]; // Pour M5

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phasesEnPanne?: string[]; // Pour M4

  // ✅ NOUVEAU : IDs des planifications concernées par cette pause
  // Ces planifications doivent avoir un OF non null (= avoir un planning)
  // Une pause peut concerner plusieurs références planifiées simultanément
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  planificationIds?: number[];
}