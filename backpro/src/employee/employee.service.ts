import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  // ─── CREATE ───────────────────────────────────────────────────────────────
  async create(dto: CreateEmployeeDto): Promise<Employee> {
    // Vérifier unicité matricule et CIN
    const existing = await this.employeeRepository.findOne({
      where: [{ matricule: dto.matricule }, { cin: dto.cin }],
    });

    if (existing) {
      if (existing.matricule === dto.matricule)
        throw new ConflictException(`Matricule "${dto.matricule}" déjà utilisé`);
      if (existing.cin === dto.cin)
        throw new ConflictException(`CIN "${dto.cin}" déjà utilisé`);
    }

    const employee = this.employeeRepository.create(dto);
    return this.employeeRepository.save(employee);
  }

  // ─── READ ALL (avec recherche optionnelle) ────────────────────────────────
  async findAll(search?: string): Promise<Employee[]> {
    if (search) {
      return this.employeeRepository.find({
        where: [
          { nomPrenom: Like(`%${search}%`) },
          { matricule: Like(`%${search}%`) },
          { cin: Like(`%${search}%`) },
          { service: Like(`%${search}%`) },
        ],
        order: { nomPrenom: 'ASC' },
      });
    }
    return this.employeeRepository.find({ order: { nomPrenom: 'ASC' } });
  }

  // ─── READ ONE ─────────────────────────────────────────────────────────────
  async findOne(id: number): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { id } });
    if (!employee)
      throw new NotFoundException(`Employé avec l'ID ${id} introuvable`);
    return employee;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────
  async update(id: number, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findOne(id);

    // Vérifier unicité si matricule ou CIN est modifié
    if (dto.matricule && dto.matricule !== employee.matricule) {
      const exists = await this.employeeRepository.findOne({
        where: { matricule: dto.matricule },
      });
      if (exists)
        throw new ConflictException(`Matricule "${dto.matricule}" déjà utilisé`);
    }

    if (dto.cin && dto.cin !== employee.cin) {
      const exists = await this.employeeRepository.findOne({
        where: { cin: dto.cin },
      });
      if (exists)
        throw new ConflictException(`CIN "${dto.cin}" déjà utilisé`);
    }

    Object.assign(employee, dto);
    return this.employeeRepository.save(employee);
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────
  async remove(id: number): Promise<{ message: string }> {
    const employee = await this.findOne(id);
    await this.employeeRepository.remove(employee);
    return { message: `Employé "${employee.nomPrenom}" supprimé avec succès` };
  }
  
  async findByMatricule(matricule: string): Promise<Employee | null> {
  return this.employeeRepository.findOne({
    where: { matricule }  // ← correspondance EXACTE
  });
}
}