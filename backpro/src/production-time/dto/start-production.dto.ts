import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}