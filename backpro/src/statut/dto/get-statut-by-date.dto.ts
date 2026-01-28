import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class GetStatutByDateDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format de date doit être YYYY-MM-DD'
  })
  date: string;
}