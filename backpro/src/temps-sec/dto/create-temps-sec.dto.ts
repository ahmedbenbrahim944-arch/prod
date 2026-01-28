// src/temps-sec/dto/create-temps-sec.dto.ts
import { IsString, IsNumber, IsNotEmpty, Min, MaxLength } from 'class-validator';

export class CreateTempsSecDto {
  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  @MaxLength(50, { message: 'La ligne ne doit pas dépasser 50 caractères' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'La référence est obligatoire' })
  @MaxLength(50, { message: 'La référence ne doit pas dépasser 50 caractères' })
  reference: string;

  @IsNumber({}, { message: 'Le temps en secondes doit être un nombre' })
  @IsNotEmpty({ message: 'Le temps en secondes est obligatoire' })
  @Min(1, { message: 'Le temps en secondes doit être au moins 1' })
  seconde: number;
}