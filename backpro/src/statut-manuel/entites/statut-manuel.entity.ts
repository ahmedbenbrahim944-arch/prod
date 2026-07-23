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
  BADGE_OUBLIE = 'badge_oublie',
  ABSENCE_NON_JUSTIFIEE = 'absence_non_justifiee',
  ATTENTE_JUSTIFICATION = 'attente_justification',
  RAISON_FAMILIALE = 'raison_familiale',
  FIN_CONTRAT = 'fin_contrat',
  MISE_A_PIED = 'mise_a_pied',
}

// ── Sous-types applicables uniquement quand statut === MALADIE ──
export enum TypeMaladie {
  ACCOUCHEMENT = 'accouchement',
  CERTIFICAT = 'certificat',
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

  // ── Renseignés uniquement quand statut === MALADIE ──
  @Column({
    type: 'enum',
    enum: TypeMaladie,
    nullable: true,
  })
  typeMaladie: TypeMaladie | null;

  // ── Optionnel, pertinent seulement quand typeMaladie === CERTIFICAT ──
  @Column({ type: 'json', nullable: true })
  nomDocteur: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}