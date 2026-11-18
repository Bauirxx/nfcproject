import { Module } from '@nestjs/common';
import { PublicCardService } from './public-card.service';
import { PublicController } from './public.controller';

/** Módulo `sharing` (página pública, VCF e eventos públicos). */
@Module({ controllers: [PublicController], providers: [PublicCardService] })
export class PublicModule {}
