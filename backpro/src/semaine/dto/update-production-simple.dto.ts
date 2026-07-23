// src/semaine/dto/update-production-simple.dto.ts
import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateProductionSimpleDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string; // "semaine48"

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string; // "L04:RXT1"

  @IsString()
  @IsNotEmpty({ message: 'La référence est obligatoire' })
  reference: string; // "RA5246801"

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