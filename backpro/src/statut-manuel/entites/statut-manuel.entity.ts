import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TypeStatutManuel {
  CONGE = 'conge',
  MALADIE = 'maladie',
  MISSION = 'mission',
  AUTRE = 'autre',
  PRESENT = 'present',
}

@Entity('statuts_manuels')
export class StatutManuel {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Identifiant commun (Ouvrier.matricule converti en string, ou Employee.matricule directement) ──
  @Index()
  @Column({ length: 20 })
  matricule: string;

  @Column({ length: 100 })
  nomPrenom: string;

  @Column({
    type: 'enum',
    enum: TypeStatutManuel,
  })
  statut: TypeStatutManuel;

  @Column({ type: 'date' })
  dateDebut: string;

  @Column({ type: 'date' })
  dateFin: string;

  @Column({ length: 255, nullable: true })
  commentaire: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}