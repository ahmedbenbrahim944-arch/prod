// src/autosaisie/entities/badge.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Ouvrier } from '../../ouvrier/entities/ouvrier.entity';

@Entity('badge')
@Unique(['n_badget'])
export class Badge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, name: 'n_badget' })
  n_badget: string;

  @ManyToOne(() => Ouvrier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matricule', referencedColumnName: 'matricule' })
  ouvrier: Ouvrier;

  @Column({ type: 'int' })
  matricule: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}