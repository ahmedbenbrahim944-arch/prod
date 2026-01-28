// src/non-conf/dto/get-non-conf.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class GetNonConfDto {
  @IsString()
  @IsOptional()
  semaine?: string;

  @IsString()
  @IsOptional()
  jour?: string;

  @IsString()
  @IsOptional()
  ligne?: string;

  @IsString()
  @IsOptional()
  reference?: string;
}