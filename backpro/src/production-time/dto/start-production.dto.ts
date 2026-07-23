import { IsNotEmpty, IsOptional, IsString, IsArray, IsNumber } from 'class-validator';

export class StartProductionDto {
  @IsNotEmpty()
  @IsString()
  ligne: string;

  @IsOptional()
  @IsString()
  productType?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // ✅ NOUVEAU - Références planifiées sélectionnées au démarrage
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  planificationIds?: number[];
}