import { Controller, Post, Body, UsePipes, ValidationPipe, Req } from '@nestjs/common';
import type { Request } from 'express'; // ✅ Utilisation de 'import type' pour les types uniquement
import { AuthService } from './auth.service';
import { LoginAdminDto } from '../admin/dto/login-admin.dto';
import { LoginUserDto } from '../user/dto/login-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async loginAdmin(@Body() loginAdminDto: LoginAdminDto, @Req() req: Request) {
    return this.authService.loginAdmin(loginAdminDto, req);
  }

  @Post('user/login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async loginUser(@Body() loginUserDto: LoginUserDto, @Req() req: Request) {
    return this.authService.loginUser(loginUserDto, req);
  }
}