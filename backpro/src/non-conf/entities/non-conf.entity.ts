// src/non-conf/entities/non-conf.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { Planification } from '../../semaine/entities/planification.entity';
import { Commentaire } from '../../commentaire/entities/commentaire.entity'; // AJOUTÉ

@Entity('non_conformites')
export class NonConformite {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Planification, (planification) => planification.nonConformites, { onDelete: 'CASCADE' })
  planification: Planification;

  // === RELATION AVEC COMMENTAIRE (NOUVEAU) ===
  @ManyToOne(() => Commentaire, { nullable: true, eager: true })
  @JoinColumn({ name: 'commentaire_id' }) // ou garder le même nom 'commentaire'
  commentaireObjet?: Commentaire | null; // Renommer pour éviter conflit
  // ===========================================

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

  @Column({ type: 'float', default: 0 })
  environnement: number;

  @Column({ type: 'float', default: 0 })
  total: number;

  @Column({ type: 'float', default: 0, name: 'ecart_pourcentage' })
  ecartPourcentage: number;

  @Column({ type: 'text', nullable: true })
  commentaire: string | null; // Garder pour les commentaires libres

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}