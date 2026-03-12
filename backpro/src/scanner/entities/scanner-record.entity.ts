// src/scanner/entities/scanner-record.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Semaine } from '../../semaine/entities/semaine.entity';
import { Admin } from '../../admin/entities/admin.entity';
import { CodeProduit } from './code-produit.entity';

@Entity('scanner')
export class ScannerRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  fullnumber: string;

  @Column({ type: 'varchar', length: 1 })
  annee: string;

  @Column({ type: 'varchar', length: 2 })
  semaineParsed: string;

  @Column({ type: 'varchar', length: 4 })
  compteur: string;

  @Column({ type: 'varchar', length: 4 })
  codeProduitParsed: string;

  @Column({ type: 'varchar', length: 2 })
  fournisseur: string;

  @Column({ type: 'varchar', length: 3 })
  indice: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ligne: string | null;

  // ── Semaine ───────────────────────────────────────────────────────────────
  @Column({ type: 'int' })
  semaineId: number;

  @ManyToOne(() => Semaine, { eager: true, nullable: false })
  @JoinColumn({ name: 'semaineId' })
  semaine: Semaine;

  // ── Admin (scanneParId) ───────────────────────────────────────────────────
  // IMPORTANT : la propriété TS s'appelle "scanneParAdmin" pour éviter tout
  // conflit avec l'ancienne colonne "scannePar" que TypeORM pouvait générer.
  // La FK en base est UNIQUEMENT "scanneParId".
  @Column({ type: 'int', name: 'scanneParId' })
  scanneParId: number;

  @ManyToOne(() => Admin, { eager: true, nullable: false })
  @JoinColumn({ name: 'scanneParId' })
  scanneParAdmin: Admin;

  // ── CodeProduit ───────────────────────────────────────────────────────────
  @Column({ type: 'int', name: 'codeProduitId', nullable: true })
  codeProduitId: number | null;

  @ManyToOne(() => CodeProduit, (cp) => cp.scans, { eager: true, nullable: true })
  @JoinColumn({ name: 'codeProduitId' })
  codeProduit: CodeProduit | null;

  // ── Choix ligne (L1 / L2 / null) ────────────────────────────────────────
  @Column({ type: 'varchar', length: 2, nullable: true, default: null })
  ligneChoix: 'L1' | 'L2' | null;

  @CreateDateColumn()
  scannedAt: Date;
}