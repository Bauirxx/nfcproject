import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { analyticsQuerySchema, type AnalyticsQuery, type AnalyticsSummary } from '@nfc-business/shared/schemas';
import { requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQuery,
    @Req() req: AuthedRequest,
  ): Promise<AnalyticsSummary> {
    return this.analytics.summary(requirePermission(req, 'analytics.view'), query);
  }
}
