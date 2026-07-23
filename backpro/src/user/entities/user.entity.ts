// src/user/entities/user.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn 
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Admin } from '../../admin/entities/admin.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 10, unique: false }) // Temporairement sans unicité
  nom: string;

  @Column({ length: 50 })
  prenom: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Admin, (admin) => admin.usersCreated, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: Admin;

  @Column({ nullable: true })
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}