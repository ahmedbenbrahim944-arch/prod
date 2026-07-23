import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateProductionPlanificationDto {
  @IsString()
  @IsNotEmpty()
  semaine: string;

  @IsString()
  @IsNotEmpty()
  jour: string;

  @IsString()
  @IsNotEmpty()
  ligne: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  // ✅ AJOUT CRUCIAL
  @IsString()
  @IsOptional()
  poste?: string;

  @IsNumber()
  @IsOptional()
  qteModifiee?: number;

  @IsNumber()
  @IsNotEmpty()
  decProduction: number;
}