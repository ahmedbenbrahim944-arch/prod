// src/product/dto/update-product.dto.ts
import { IsOptional, IsString, IsArray, ArrayMinSize } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  ligne?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une référence est requise' })
  @IsString({ each: true, message: 'Chaque référence doit être une chaîne de caractères' })
  references?: string[];
}