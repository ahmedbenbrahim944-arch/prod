import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum Poste {
  PREMIERE = '1ere poste',
  DEUXIEME = '2eme poste',
}

@Entity('maintenance')
export class Maintenance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  matricule: string;

  @Column()
  nomPrenom: string;

  @Column({
    type: 'enum',
    enum: Poste,
  })
  poste: Poste;
}