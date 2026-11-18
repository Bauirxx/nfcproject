import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuditController } from './audit/audit.controller';
import { CompaniesController } from './companies/companies.controller';

/** Endpoints autenticados do painel (módulos analytics, audit e companies). */
@Module({
  controllers: [AnalyticsController, AuditController, CompaniesController],
  providers: [AnalyticsService],
})
export class PanelModule {}
