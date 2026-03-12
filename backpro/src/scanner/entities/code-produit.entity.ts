// src/scanner/entities/code-produit.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ScannerRecord } from './scanner-record.entity';

@Entity('codeproduit')
export class CodeProduit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  code: string; // ex: "7295"

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string; // ex: "1SDR000351A1809"

  @Column({ type: 'varchar', length: 100, nullable: true })
  ligne: string; // ex: "L33:COMXT5"

  @OneToMany(() => ScannerRecord, (record) => record.codeProduit)
  scans: ScannerRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}