import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuditController } from './audit/audit.controller';
import { CardsController } from './cards/cards.controller';
import { CompaniesController } from './companies/companies.controller';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { ProfilesController } from './profiles/profiles.controller';

/** Endpoints autenticados do painel (módulos analytics, audit, cards, companies, members e profiles). */
@Module({
  controllers: [
    AnalyticsController,
    AuditController,
    CardsController,
    CompaniesController,
    MembersController,
    ProfilesController,
  ],
  providers: [AnalyticsService, MembersService],
})
export class PanelModule {}
