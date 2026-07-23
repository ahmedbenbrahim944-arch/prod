// src/product/dto/add-references.dto.ts
import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class AddReferencesDto {
  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  ligne: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une référence est requise' })
  @IsString({ each: true, message: 'Chaque référence doit être une chaîne de caractères' })
  references: string[];
}