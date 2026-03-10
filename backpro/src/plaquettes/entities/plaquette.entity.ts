// src/plaquettes/entities/plaquette.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Admin } from '../../admin/entities/admin.entity';
import { Semaine } from '../../semaine/entities/semaine.entity';
import { MatriculeMachine } from './matricule-machine.entity';
import { TypePlaquette } from './type-plaquette.entity';

@Entity('plaquettes')
export class Plaquette {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: Date;

  @ManyToOne(() => Semaine, { eager: true, nullable: false })
  semaine: Semaine;

  @Column({ type: 'varchar', length: 255 })
  ligne: string;

  @Column({ type: 'varchar', length: 100 })
  reference: string;

  @ManyToOne(() => MatriculeMachine, { eager: true, nullable: false })
  matriculeMachine: MatriculeMachine;

  // Type de plaquette — obligatoire, doit exister dans type_plaquettes
  @ManyToOne(() => TypePlaquette, { eager: true, nullable: false })
  typePlaquette: TypePlaquette;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantiteDonnee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reste: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  produitFini: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rebut: number;

  // Consommation = quantiteDonnee - reste (recalculée à chaque update)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  consommation: number;

  @ManyToOne(() => Admin, { eager: true, nullable: false })
  creePar: Admin;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}