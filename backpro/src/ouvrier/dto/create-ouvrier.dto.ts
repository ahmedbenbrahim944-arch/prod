// src/ouvrier/dto/create-ouvrier.dto.ts
import { IsNumber, IsString, IsNotEmpty, Min, Max, MaxLength } from 'class-validator';

export class CreateOuvrierDto {
  @IsNumber({}, { message: 'Le matricule doit être un nombre' })
  @IsNotEmpty({ message: 'Le matricule est obligatoire' })
  @Min(1, { message: 'Le matricule doit être au moins 1' })
  @Max(999999, { message: 'Le matricule ne doit pas dépasser 999999' })
  matricule: number;

  @IsString()
  @IsNotEmpty({ message: 'Le nom et prénom sont obligatoires' })
  @MaxLength(100, { message: 'Le nom et prénom ne doivent pas dépasser 100 caractères' })
  nomPrenom: string;
}