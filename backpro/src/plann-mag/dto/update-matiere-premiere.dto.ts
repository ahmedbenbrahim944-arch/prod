// src/plann-mag/dto/update-matiere-premiere.dto.ts
import { IsString, IsOptional, IsNumber, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMatierePremiereDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ligne?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceLigne?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refMp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  coeffImpiego?: number;
}