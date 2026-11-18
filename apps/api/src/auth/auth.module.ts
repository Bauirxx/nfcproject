import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AuthController } from './auth.controller';
import { MfaController } from './mfa.controller';

@Module({ controllers: [AuthController, MfaController, AccountController] })
export class AuthModule {}
