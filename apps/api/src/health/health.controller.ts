import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/public.decorator';

/** Verificação de saúde, pública (critério de saída da fase 1: os endpoints públicos são explícitos). */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
