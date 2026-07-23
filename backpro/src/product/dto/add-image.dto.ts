// src/product/dto/add-image.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddImageDto {
  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  ligne: string;
}