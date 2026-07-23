// src/affectation/entities/affectation-phase.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Affectation } from './affectation.entity';

@Entity('affectation_phase')
@Unique(['affectation', 'phase']) // une phase ne peut pas être dupliquée pour la même affectation
export class AffectationPhase {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Affectation, (aff) => aff.phases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'affectation_id' })
  affectation: Affectation;

  @Column({ type: 'varchar', length: 50 })
  phase: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  heures: number;
}