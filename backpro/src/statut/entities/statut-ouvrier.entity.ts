// src/statut/entities/statut-ouvrier.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('statut_ouvrier')
export class StatutOuvrier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  matricule: number;

  @Column()
  nomPrenom: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ 
    type: 'enum', 
    enum: ['P', 'AB', 'C', 'S'],
    default: 'P'
  })
  statut: string;

  @Column({ nullable: true })
  commentaire: string;

  @CreateDateColumn()
  createdAt: Date;
}