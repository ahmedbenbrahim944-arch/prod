

// src/semaine/entities/planification.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany,
  Unique
} from 'typeorm';
import { Semaine } from './semaine.entity';
import { NonConformite } from '../../non-conf/entities/non-conf.entity';

@Entity('planifications')
@Unique(['semaine', 'jour', 'ligne', 'reference', 'poste'])
export class Planification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  semaine: string;

  @Column({ type: 'varchar', length: 20 })
  jour: string;

  @Column({ type: 'varchar', length: 255 })
  ligne: string;

  @Column({ type: 'varchar', length: 100 })
  reference: string;

  // ✅ NOUVEAU : Poste de travail (poste1 = 6h-14h | poste2 = 14h-22h)
  // Par défaut 'poste1' pour ne pas casser les données existantes
  @Column({ type: 'varchar', length: 10, default: 'poste1' })
  poste: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  of: string;

  @Column({ type: 'int', default: 0 })
  qtePlanifiee: number;

  @Column({ type: 'int', default: 0 })
  qteModifiee: number;

  @Column({ type: 'varchar', length: 100, default: '200' })
  emballage: string;

  @Column({ type: 'float', default: 0 })
  nbOperateurs: number;

  @Column({ type: 'float', default: 0 })
  nbHeuresPlanifiees: number;

  @Column({ type: 'int', default: 0 })
  decProduction: number;

  @Column({ type: 'int', default: 0 })
  decMagasin: number;

  @Column({ type: 'int', default: 0 })
  exp: number;

  @Column({ type: 'text', nullable: true, default: null })
  note: string | null;

  // CHAMPS CALCULÉS
  @Column({ type: 'int', default: 0 })
  deltaProd: number;

  @Column({ type: 'float', default: 0 })
  pcsProd: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Semaine, (semaine) => semaine.planifications, { onDelete: 'CASCADE' })
  semaineEntity: Semaine;

  @OneToMany(() => NonConformite, (nc) => nc.planification, { cascade: true })
  nonConformites: NonConformite[];
}