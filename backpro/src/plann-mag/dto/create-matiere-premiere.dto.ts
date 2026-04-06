// src/plann-mag/dto/create-matiere-premiere.dto.ts
import { IsString, IsNotEmpty, IsNumber, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMatierePremiereDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ligne: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  referenceLigne: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  refMp: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  coeffImpiego: number;
}