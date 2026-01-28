// src/saisie-rapport/dto/create-saisie-rapport.dto.ts
import { IsString, IsNotEmpty, IsNumber, IsArray, Min, Max, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PhaseHeureDto {
  @IsString()
  @IsNotEmpty({ message: 'La phase est obligatoire' })
  phase: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Les heures sont obligatoires' })
  @Min(0.5, { message: 'Les heures doivent être au moins 0.5' })
  @Max(8, { message: 'Les heures ne doivent pas dépasser 8' })
  heures: number;
}

export class CreateSaisieRapportDto {
  @IsString()
  @IsNotEmpty({ message: 'La semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsNotEmpty({ message: 'Le jour est obligatoire' })
  jour: string;

  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  ligne: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Le matricule est obligatoire' })
  @Min(1, { message: 'Le matricule doit être au moins 1' })
  @Max(999999, { message: 'Le matricule ne doit pas dépasser 999999' })
  matricule: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une phase doit être spécifiée' })
  @ArrayMaxSize(3, { message: 'Maximum 3 phases par jour' })
  @ValidateNested({ each: true })
  @Type(() => PhaseHeureDto)
  phases: PhaseHeureDto[];
}