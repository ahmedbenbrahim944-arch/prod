// src/user/user.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  UseGuards,
  Request,
  UsePipes, 
  ValidationPipe,
  ClassSerializerInterceptor,
  UseInterceptors
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Controller('user')
@UseInterceptors(ClassSerializerInterceptor) // Exclure les champs @Exclude()
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Créer un chef secteur - Seulement par l'admin
  @Post()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createUserDto: CreateUserDto, @Request() req) {
    const adminId = req.user.id; // ID de l'admin connecté
    const user = await this.userService.createUser(createUserDto, adminId);
    
    return {
      message: 'Chef secteur créé avec succès',
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        createdAt: user.createdAt
      },
    };
  }

  // Récupérer tous les chefs secteur - Admin seulement
  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findAll() {
    return await this.userService.findAll();
  }

  // Récupérer un chef secteur par ID - Admin seulement
  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(+id);
  }

  // Modifier un chef secteur - Admin seulement
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto
  ) {
    const user = await this.userService.update(+id, updateUserDto);
    
    return {
      message: 'Chef secteur modifié avec succès',
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        isActive: user.isActive
      },
    };
  }

  // Activer/Désactiver un chef secteur - Admin seulement
  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async toggleActive(@Param('id') id: string) {
    return await this.userService.toggleActive(+id);
  }

  // Supprimer un chef secteur - Admin seulement
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(@Param('id') id: string) {
    await this.userService.remove(+id);
    return { message: 'Chef secteur supprimé avec succès' };
  }
}