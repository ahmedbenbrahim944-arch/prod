import { IsString, IsNotEmpty } from 'class-validator';

export class GetStatsSemaineDto {
  @IsString()
  @IsNotEmpty({ message: 'La semaine est obligatoire' })
  semaine: string;
}