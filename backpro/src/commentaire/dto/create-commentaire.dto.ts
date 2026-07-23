// src/commentaire/dto/create-commentaire.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCommentaireDto {
  @IsNotEmpty()
  @IsString()
  commentaire: string;
}