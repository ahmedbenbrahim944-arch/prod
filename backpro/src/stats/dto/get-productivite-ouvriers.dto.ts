// src/stats/dto/get-productivite-ouvriers.dto.ts
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class GetProductiviteOuvriersDto {
  @IsString()
  @IsNotEmpty({ message: 'La date de début est obligatoire' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Le format de date doit être YYYY-MM-DD (ex: 2026-01-05)'
  })
  dateDebut: string;

  @IsString()
  @IsNotEmpty({ message: 'La date de fin est obligatoire' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Le format de date doit être YYYY-MM-DD (ex: 2026-01-20)'
  })
  dateFin: string;
}