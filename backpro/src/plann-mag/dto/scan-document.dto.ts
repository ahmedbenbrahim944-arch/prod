// src/plann-mag/dto/scan-document.dto.ts
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ScanDocumentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^G\d{5,}$/, {
    message: 'Le code document doit commencer par G suivi de chiffres (ex: G89651603)',
  })
  codeDocument: string; // ex: G89651603
}