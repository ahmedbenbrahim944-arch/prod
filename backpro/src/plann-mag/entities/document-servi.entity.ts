// src/plann-mag/entities/document-servi.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('document_servi')
export class DocumentServi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, name: 'code_document', unique: true })
  codeDocument: string; // ex: G89651603

  @Column({ type: 'varchar', length: 50 })
  ligne: string; // ex: L04:RXT1

  @Column({ type: 'varchar', length: 50 })
  of: string; // ex: 8965

  @Column({ type: 'varchar', length: 10, name: 'date_doc' })
  dateDoc: string; // ex: 1603 (DDMM)

  @Column({ type: 'varchar', length: 20, name: 'date_formatee' })
  dateFormatee: string; // ex: 16/03/2026

  @Column({ type: 'varchar', length: 50 })
  semaine: string; // ex: semaine12

  @Column({ type: 'varchar', length: 100, name: 'servi_par', nullable: true })
  serviPar: string | null; // username depuis JWT

  @CreateDateColumn({ name: 'servi_le' })
  serviLe: Date; // timestamp automatique
}