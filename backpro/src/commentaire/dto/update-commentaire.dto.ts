// src/commentaire/dto/update-commentaire.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCommentaireDto {
  @IsNotEmpty()
  @IsString()
  commentaire: string;
}