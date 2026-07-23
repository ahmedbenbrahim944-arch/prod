// src/non-conf/dto/get-non-conf-by-date.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GetNonConfByDateDto {
  @IsString()
  @IsNotEmpty({ message: 'La date est obligatoire' })
  date: string; // Format: "YYYY-MM-DD"

  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  ligne: string;

  @IsOptional()
  @IsString()
  semaine?: string; // Optionnel: si on veut aussi filtrer par semaine
}