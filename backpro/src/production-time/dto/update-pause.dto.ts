import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class UpdatePauseDto {
  @IsNotEmpty()
  pauseId: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // ✅ NOUVEAUX CHAMPS pour mettre à jour les références
  
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
}