import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Admin } from '../../admin/entities/admin.entity';
import { User } from '../../user/entities/user.entity';

@Entity('user_activities')
export class UserActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 10, nullable: true })
  @Index()
  matricule: string;

  @Column({ length: 20 })
  userType: string; // 'admin' ou 'user'

  @Column({ nullable: true })
  userId: number;

  @ManyToOne(() => Admin, { nullable: true })
  @JoinColumn({ name: 'adminId' })
  admin: Admin;

  @Column({ nullable: true })
  adminId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 50 })
  actionType: string; // 'PAGE_VIEW', 'API_CALL', 'ERROR', 'LOGIN', 'LOGOUT'

  @Column({ length: 500 })
  url: string;

  @Column({ length: 200, nullable: true })
  route: string; // La route sans les paramètres

  @Column({ length: 100, nullable: true })
  componentName: string;

  @Column({ length: 10 })
  method: string; // GET, POST, PUT, DELETE

  @Column({ type: 'json', nullable: true })
  requestData: any;

  @Column({ type: 'json', nullable: true })
  responseData: any;

  @Column({ type: 'int', default: 200 })
  statusCode: number;

  @Column({ type: 'int', nullable: true })
  responseTime: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ length: 45, nullable: true })
  ipAddress: string;

  @Column({ length: 255, nullable: true })
  userAgent: string;

  @Column({ length: 100, nullable: true })
  sessionId: string;

  @Column({ type: 'int', nullable: true })
  pageLoadTime: number; // Temps de chargement de la page

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}