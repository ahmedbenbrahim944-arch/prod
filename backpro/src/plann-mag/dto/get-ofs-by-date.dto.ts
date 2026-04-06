// src/plann-mag/dto/get-ofs-by-date.dto.ts
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class GetOfsByDateDto {
  @IsString()
  @IsNotEmpty()
  annee: string; // ex: "2026"

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, { message: 'date doit être au format DDMM ex: 0204' })
  date: string; // ex: "0204" = 02 avril
}