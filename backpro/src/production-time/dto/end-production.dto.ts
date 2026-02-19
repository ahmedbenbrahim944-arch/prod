import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class EndProductionDto {
  @IsNotEmpty()
  sessionId: number;

  @IsOptional()
  @IsString()
  finalNotes?: string;

  @IsOptional()
  @IsNumber()
  quantityProduced?: number;

  @IsOptional()
  @IsString()
  qualityStatus?: string; // 'good', 'with_defects', 'rejected'
}