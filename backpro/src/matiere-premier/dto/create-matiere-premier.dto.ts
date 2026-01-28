// src/matiere-premier/dto/create-matiere-premier.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMatierePremierDto {
  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  @MaxLength(50, { message: 'La ligne ne doit pas dépasser 50 caractères' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'La référence matière première est obligatoire' })
  @MaxLength(50, { message: 'La référence matière première ne doit pas dépasser 50 caractères' })
  refMatierePremier: string;
}