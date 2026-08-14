import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles';

@Global()
@Module({
  imports: [PassportModule, JwtModule.register({ global: true, secret: process.env.JWT_SECRET, signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as any } })],
  controllers: [AuthController], providers: [AuthService, JwtStrategy, RolesGuard], exports: [JwtModule, RolesGuard],
})
export class AuthModule {}
