import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { jwtConstants } from './constants';
import { AdminModule } from '../admin/admin.module';
import { UserModule } from '../user/user.module';
import { TrackingModule } from '../tracking/tracking.module'; // ✅ Ajouter cette ligne

@Module({
  imports: [
    AdminModule,
    UserModule,
    TrackingModule, // ✅ Ajouter TrackingModule ici
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: jwtConstants.expiresIn },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}