// src/non-conf/dto/get-total-ecart.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GetTotalEcartDto {
  @IsString()
  @IsNotEmpty({ message: 'La semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsNotEmpty({ message: 'La ligne est obligatoire' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'La référence est obligatoire' })
  reference: string;
}