// src/plann-mag/dto/get-plann-mag.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GetPlannMagDto {
  @IsString()
  @IsNotEmpty()
  semaine: string;
}