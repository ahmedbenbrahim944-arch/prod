// src/affectation/entities/affectation.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Column,
  CreateDateColumn,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Ouvrier } from '../../ouvrier/entities/ouvrier.entity';
import { AffectationPhase } from './affectation-phase.entity';

@Entity('affectation')
@Unique(['ouvrier'])
export class Affectation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ouvrier, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matricule', referencedColumnName: 'matricule' })
  ouvrier: Ouvrier;

  @Column({ type: 'varchar', length: 50 })
  ligne: string;

  // Nouveau champ : indique si cet ouvrier est capitaine de sa ligne
  @Column({ type: 'boolean', default: false })
  estCapitaine: boolean;

  @OneToMany(() => AffectationPhase, (ap) => ap.affectation, {
    cascade: true,
    eager: true,
  })
  phases: AffectationPhase[];

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'varchar', length: 20 })  // 'jour' ou 'nuit'
poste: string;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  bus: string | null;  // ← nouveau : numéro de bus de transport
}