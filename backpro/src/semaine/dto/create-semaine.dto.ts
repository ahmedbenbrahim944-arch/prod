// src/semaine/dto/create-semaine.dto.ts
import { IsString, IsNotEmpty, IsDate, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSemaineDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  @Matches(/^semaine[0-9]{1,2}$/, { 
    message: 'Le nom de la semaine doit être au format "semaineXX"' 
  })
  nom: string;

  @IsDate()
  @IsNotEmpty({ message: 'La date de début est obligatoire' })
  @Type(() => Date) // Important pour la transformation
  dateDebut: Date;

  @IsDate()
  @IsNotEmpty({ message: 'La date de fin est obligatoire' })
  @Type(() => Date) // Important pour la transformation
  dateFin: Date;
}