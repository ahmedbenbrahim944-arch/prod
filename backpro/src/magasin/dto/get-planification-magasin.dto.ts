import { IsString, IsNotEmpty } from 'class-validator';

export class GetPlanificationMagasinDto {
 

  @IsString()
  @IsNotEmpty({ message: 'Le nom de la semaine est obligatoire' })
  semaine: string;
}