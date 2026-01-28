// src/semaine/dto/update-planification-by-criteria.dto.ts
import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdatePlanificationByCriteriaDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsNotEmpty({ message: 'Le jour est obligatoire' })
  jour: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'La référence est obligatoire' })
  reference: string;

  @IsString()
  @IsOptional()
  of?: string;

  @IsNumber()
  @IsOptional()
  qtePlanifiee?: number;

  // NOUVEAU : Qte Modifiée
  @IsNumber()
  @IsOptional()
  qteModifiee?: number;

  @IsString()
  @IsOptional()
  emballage?: string;

  @IsNumber()
  @IsOptional()
  decProduction?: number;

  @IsNumber()
  @IsOptional()
  decMagasin?: number;
}