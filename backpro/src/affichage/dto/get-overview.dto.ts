// src/affichage/dto/get-overview.dto.ts
import { IsDateString, IsNotEmpty } from 'class-validator';

export class GetOverviewDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;
}