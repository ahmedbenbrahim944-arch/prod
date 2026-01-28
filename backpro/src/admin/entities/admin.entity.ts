// src/admin/entities/admin.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  OneToMany 
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { User } from '../../user/entities/user.entity';
import { Product } from '../../product/entities/product.entity';
import { Semaine } from '../../semaine/entities/semaine.entity';
import { TempsSec } from '../../temps-sec/entities/temps-sec.entity';


@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 10, unique: true }) // Réduit à 10 caractères max
  nom: string;

  @Column({ length: 50 })
  prenom: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ default: true })
  isActive: boolean;

  // Relation: Un admin peut créer plusieurs users (chefs secteur)
  @OneToMany(() => User, (user) => user.createdBy)
  usersCreated: User[];

  @OneToMany(() => Product, (product) => product.createdBy)
  productsCreated: Product[];

  // Relation: Un admin peut créer plusieurs semaines
  @OneToMany(() => Semaine, (semaine) => semaine.creePar)
  semainesCrees: Semaine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
  // Dans src/admin/entities/admin.entity.ts
}
