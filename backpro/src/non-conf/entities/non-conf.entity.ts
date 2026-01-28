// src/non-conf/entities/non-conf.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Planification } from '../../semaine/entities/planification.entity';

@Entity('non_conformites')
export class NonConformite {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Planification, (planification) => planification.nonConformites, { onDelete: 'CASCADE' })
  planification: Planification;

  // Les 7M (6M précédents + Environnement)
  @Column({ type: 'float', default: 0 })
  matierePremiere: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceMatierePremiere: string | null;

  @Column({ type: 'float', default: 0 })
  absence: number;

  @Column({ type: 'float', default: 0 })
  rendement: number;

  @Column({ type: 'float', default: 0 })
  methode: number;

  @Column({ type: 'float', default: 0 })
  maintenance: number;

  @Column({ type: 'float', default: 0 })
  qualite: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceQualite: string | null;

  @Column({ type: 'float', default: 0 })  // NOUVEAU CHAMP
  environnement: number;

  @Column({ type: 'float', default: 0 })
  total: number;  // Total des 7M maintenant

  @Column({ type: 'float', default: 0, name: 'ecart_pourcentage' })
  ecartPourcentage: number;

  @Column({ type: 'text', nullable: true })
  commentaire: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}