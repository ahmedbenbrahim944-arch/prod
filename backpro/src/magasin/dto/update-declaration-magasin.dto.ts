import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateDeclarationMagasinDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;

  @IsString()
  @IsNotEmpty({ message: 'Le jour est obligatoire' })
  jour: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ligne est obligatoire' })
  ligne: string;

  @IsString()
  @IsNotEmpty({ message: 'La référence est obligatoire' })
  reference: string;

  @IsNumber()
  @IsNotEmpty({ message: 'La déclaration magasin est obligatoire' })
  decMagasin: number;
}