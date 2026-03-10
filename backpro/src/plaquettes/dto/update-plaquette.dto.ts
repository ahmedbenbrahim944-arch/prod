// src/plaquettes/dto/update-plaquette.dto.ts
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlaquetteDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reste?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  produitFini?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rebut?: number;
}