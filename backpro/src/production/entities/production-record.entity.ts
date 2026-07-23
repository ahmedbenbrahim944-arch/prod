// src/production/entities/production-record.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Admin } from '../../admin/entities/admin.entity';

@Entity('production_records')
@Index(['ligne', 'dateScan'])
export class ProductionRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  ligne: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  reference: string;

  @Column({ type: 'int' })
  quantite: number;

  @Column({ type: 'varchar', length: 255 })
  codeOriginal: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dernierePartie: string | null;

  @CreateDateColumn()
  @Index()
  dateScan: Date;

  @ManyToOne(() => Admin, { nullable: true })
  scannePar: Admin | null;

  @Column({ type: 'int', nullable: true })
  scanneParId: number | null;
}