// src/affichage/dto/get-affichage.dto.ts
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class GetAffichageDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  ligne: string;
}