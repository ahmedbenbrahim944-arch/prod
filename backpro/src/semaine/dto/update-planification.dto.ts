// src/semaine/dto/update-planification.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdatePlanificationDto {
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