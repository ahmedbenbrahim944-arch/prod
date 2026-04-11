// src/production/dto/create-production.dto.ts
import { IsString, IsNotEmpty, Min, IsInt, IsOptional } from 'class-validator';

export class CreateProductionDto {
  @IsString()
  @IsNotEmpty()
  qrCode: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantite?: number;

  @IsInt()
  @IsOptional()
  scanneParId?: number;
}