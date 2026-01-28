// src/auth/auth.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAdminDto } from '../admin/dto/login-admin.dto';
import { LoginUserDto } from '../user/dto/login-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async loginAdmin(@Body() loginAdminDto: LoginAdminDto) {
    return this.authService.loginAdmin(loginAdminDto);
  }

  @Post('user/login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.authService.loginUser(loginUserDto);
  }
}