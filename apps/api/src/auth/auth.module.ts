import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MfaController } from './mfa.controller';

@Module({ controllers: [AuthController, MfaController] })
export class AuthModule {}
