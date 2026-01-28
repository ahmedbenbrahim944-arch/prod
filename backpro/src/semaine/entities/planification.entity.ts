// src/semaine/entities/planification.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Semaine } from './semaine.entity';
import { OneToMany } from 'typeorm';
import { NonConformite } from '../../non-conf/entities/non-conf.entity';

@Entity('planifications')
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

  @Column({ type: 'varchar', length: 100, default: '' })
  of: string;

  @Column({ type: 'int', default: 0 })
  qtePlanifiee: number;

  // NOUVEAU CHAMP : Quantité Modifiée
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

  // CHAMPS CALCULÉS
  @Column({ type: 'int', default: 0 })
  deltaProd: number; // qteModifiee - decProduction

  @Column({ type: 'float', default: 0 })
  pcsProd: number; // (decProduction / qteModifiee) * 100

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Semaine, (semaine) => semaine.planifications, { onDelete: 'CASCADE' })
  semaineEntity: Semaine;
  // Ajouter dans planification.entity.ts
@OneToMany(() => NonConformite, (nonConformite) => nonConformite.planification, { cascade: true })
nonConformites: NonConformite[];
}