// src/semaine/dto/update-production.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateProductionDto {
  @IsString()
  @IsOptional()
  of?: string;

  @IsNumber()
  @IsOptional()
  qtePlanifiee?: number;

  @IsString()
  @IsOptional()
  emballage?: string;

  @IsNumber()
  @IsOptional()
  nbOperateurs?: number;

  @IsNumber()
  @IsOptional()
  decProduction?: number;

  @IsNumber()
  @IsOptional()
  decMagasin?: number;
}