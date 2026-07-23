// src/product/dto/create-product.dto.ts
import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  ligne: string;

  @IsArray({ message: 'Les références doivent être un tableau' })
  @ArrayMinSize(1, { message: 'Au moins une référence est requise' })
  @IsString({ each: true, message: 'Chaque référence doit être une chaîne de caractères' })
  references: string[];
}