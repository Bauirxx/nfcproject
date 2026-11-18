import { Body, Controller, HttpCode, Inject, Param, Post, Put, Req, UnprocessableEntityException } from '@nestjs/common';
import type { UploadPurpose } from '@nfc-business/shared/constants';
import type { Permission } from '@nfc-business/shared/permissions';
import {
  uploadSignRequestSchema,
  type UploadSignRequest,
  type UploadSignResponse,
} from '@nfc-business/shared/schemas';
import { requirePermission } from '../common/access';
import type { AuthedRequest } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UploadsService } from './uploads.service';

/** Quem pode pedir cada tipo de upload: a mesma permissão de quem edita o recurso de destino. */
export const PERMISSION_BY_PURPOSE: Record<UploadPurpose, Permission> = {
  profile_photo: 'profiles.edit',
  theme_logo: 'themes.manage',
  company_logo: 'companies.manage',
};

@Controller('uploads')
export class UploadsController {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) {}

  /** «URL assinado» na mesma origem (sempre por baixo de /api/), de uso único e válido 15 minutos. */
  @Post('sign')
  async sign(
    @Body(new ZodValidationPipe(uploadSignRequestSchema)) body: UploadSignRequest,
    @Req() req: AuthedRequest,
  ): Promise<UploadSignResponse> {
    const user = requirePermission(req, PERMISSION_BY_PURPOSE[body.purpose]);
    const fileId = await this.uploads.sign(user, body.purpose, body.contentType, body.size);
    return { fileId, uploadUrl: `/api/uploads/${fileId}` };
  }

  /** Recebe os bytes (corpo binário até 2 MB, ver main.ts). */
  @Put(':fileId')
  @HttpCode(204)
  async receive(@Param('fileId') fileId: string, @Req() req: AuthedRequest): Promise<void> {
    const user = req.user;
    if (!user) throw new UnprocessableEntityException({ error: { code: 'invalid_file' } });
    const body: unknown = req.body;
    const bytes = Buffer.isBuffer(body) ? new Uint8Array(body) : new Uint8Array();
    await this.uploads.receive(user, fileId, bytes, req.headers['content-type']);
  }
}
