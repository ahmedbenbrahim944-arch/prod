// src/product/dto/create-product.dto.ts
import { IsString, IsNotEmpty, Matches, ArrayMinSize } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  
  ligne: string;

  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'Au moins une référence est requise' })
  references: string[];
}