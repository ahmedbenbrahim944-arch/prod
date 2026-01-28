// src/semaine/dto/update-production-planification.dto.ts
import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateProductionPlanificationDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsNotEmpty({ message: 'Le jour est obligatoire' })
  jour: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'La référence est obligatoire' })
  reference: string;

  @IsNumber()
  @IsOptional() // Rendre optionnel
  qteModifiee?: number;

  @IsNumber()
  @IsNotEmpty({ message: 'La déclaration production est obligatoire' })
  decProduction: number;
}