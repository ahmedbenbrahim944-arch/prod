import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('pointages')
export class Pointage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  badge: string;

  @Index()
  @Column()
  matricule: number; // = codice_as400

  @Column({ length: 100 })
  nomPrenom: string; // = risorsa

  @Index()
  @Column()
  dataOra: Date; // = data_ora

  @Column({ length: 10 })
  ingressoUscita: string; // = ingresso_uscita

  @Column({ length: 10 })
  timbratrice: string;

  @CreateDateColumn()
  importedAt: Date;
}