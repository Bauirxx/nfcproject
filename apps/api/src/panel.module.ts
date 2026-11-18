import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuditController } from './audit/audit.controller';
import { CardsController } from './cards/cards.controller';
import { CompaniesController } from './companies/companies.controller';
import { ProfilesController } from './profiles/profiles.controller';

/** Endpoints autenticados do painel (módulos analytics, audit, cards, companies e profiles). */
@Module({
  controllers: [AnalyticsController, AuditController, CardsController, CompaniesController, ProfilesController],
  providers: [AnalyticsService],
})
export class PanelModule {}
