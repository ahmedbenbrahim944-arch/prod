import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SituationFamiliale {
  CELIBATAIRE = 'Célibataire',
  MARIE = 'Marié(e)',
  DIVORCE = 'Divorcé(e)',
  VEUF = 'Veuf/Veuve',
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 20 })
  matricule: string;

  @Column({ length: 100 })
  nomPrenom: string;

  @Column({ type: 'date' })
  dateNaissance: string;

 @Column({ nullable: true, length: 20 })
cin: string;

  @Column({ length: 20 })
  numTel: string;

  @Column({ type: 'date' })
  dateEmbauche: string;

  @Column({
    type: 'enum',
    enum: SituationFamiliale,
    default: SituationFamiliale.CELIBATAIRE,
  })
  situationFamiliale: SituationFamiliale;

  @Column({ length: 50, nullable: true })
  bus: string;

  @Column({ length: 100 })
  lieu: string;

  @Column({ length: 100 })
  service: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}