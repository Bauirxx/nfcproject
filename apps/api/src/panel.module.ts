import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuditController } from './audit/audit.controller';
import { CardsController } from './cards/cards.controller';
import { CompaniesController } from './companies/companies.controller';
import { ContactSendingService } from './contact-sending/contact-sending.service';
import { ContactSharesController, UnsubscribeController } from './contact-sending/contact-shares.controller';
import { EmailService } from './email/email.service';
import { PublicCardService } from './public/public-card.service';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { ProfilesController } from './profiles/profiles.controller';
import { ImageProcessorService } from './uploads/image-processor.service';
import { UploadsController } from './uploads/uploads.controller';
import { UploadsService } from './uploads/uploads.service';

/** Endpoints autenticados do painel (módulos analytics, audit, cards, companies, contact-sending, members, profiles e uploads). */
@Module({
  controllers: [
    AnalyticsController,
    AuditController,
    CardsController,
    CompaniesController,
    ContactSharesController,
    MembersController,
    ProfilesController,
    UnsubscribeController,
    UploadsController,
  ],
  providers: [
    AnalyticsService,
    ContactSendingService,
    EmailService,
    ImageProcessorService,
    MembersService,
    PublicCardService,
    UploadsService,
  ],
})
export class PanelModule {}
