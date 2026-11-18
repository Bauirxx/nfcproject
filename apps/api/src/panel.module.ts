import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuditController } from './audit/audit.controller';
import { CardsController } from './cards/cards.controller';
import { CompaniesController } from './companies/companies.controller';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { ProfilesController } from './profiles/profiles.controller';
import { ImageProcessorService } from './uploads/image-processor.service';
import { UploadsController } from './uploads/uploads.controller';
import { UploadsService } from './uploads/uploads.service';

/** Endpoints autenticados do painel (módulos analytics, audit, cards, companies, members, profiles e uploads). */
@Module({
  controllers: [
    AnalyticsController,
    AuditController,
    CardsController,
    CompaniesController,
    MembersController,
    ProfilesController,
    UploadsController,
  ],
  providers: [AnalyticsService, ImageProcessorService, MembersService, UploadsService],
})
export class PanelModule {}
