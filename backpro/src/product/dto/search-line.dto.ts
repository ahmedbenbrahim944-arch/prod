// src/product/dto/search-line.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class SearchLineDto {
  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  ligne: string;
}