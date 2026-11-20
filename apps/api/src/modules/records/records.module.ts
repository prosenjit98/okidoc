import { Body, Controller, Delete, Get, Module, Param, Post, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { recordMetaSchema } from '@okidoc/shared';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../../common/auth';
import { forbidden, must } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { StorageService, UploadedFile as StoredFile } from '../storage/storage.service';

/** PAT-14 patient records: private files, visible to the owner and to doctors they were shared with at booking. */
@Controller('records')
export class RecordsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Roles('PATIENT')
  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.prisma.record.findMany({
      where: { ownerId: u.id, deletedAt: null },
      orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, type: true, memberId: true, doctorName: true, recordDate: true, mimeType: true, size: true, createdAt: true },
    });
  }

  @Roles('PATIENT')
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@CurrentUser() u: AuthUser, @UploadedFile() file: StoredFile, @Body() body: Record<string, string>) {
    const meta = recordMetaSchema.parse({ ...body, memberId: body.memberId || null });
    if (meta.memberId) must(await this.prisma.familyMember.findFirst({ where: { id: meta.memberId, ownerId: u.id, deletedAt: null } }), 'Family member');
    const key = await this.storage.save(file, `records/${u.id}`, 'private');
    return this.prisma.record.create({
      data: { ...meta, ownerId: u.id, fileKey: key, mimeType: file.mimetype, size: file.size },
      select: { id: true, title: true, type: true, memberId: true, doctorName: true, recordDate: true, mimeType: true, size: true, createdAt: true },
    });
  }

  @Get(':id/file')
  async file(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const r = must(await this.prisma.record.findFirst({ where: { id, deletedAt: null } }), 'Record');
    if (r.ownerId !== u.id) {
      // Doctors can open records shared with one of their bookings.
      const shared = u.doctorId
        ? await this.prisma.booking.count({ where: { sharedRecords: { some: { id } }, instance: { sitting: { link: { doctorId: u.doctorId } } } } })
        : 0;
      if (!shared) throw forbidden();
    }
    res.setHeader('content-type', r.mimeType);
    res.setHeader('content-disposition', `inline; filename="${r.title.replace(/[^\w.-]+/g, '_')}"`);
    res.setHeader('cache-control', 'private, no-store');
    return new StreamableFile(this.storage.stream(r.fileKey));
  }

  @Roles('PATIENT')
  @Delete(':id')
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const r = must(await this.prisma.record.findFirst({ where: { id, ownerId: u.id, deletedAt: null } }), 'Record');
    await this.prisma.record.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.storage.remove(r.fileKey);
    return { ok: true };
  }
}

@Module({ controllers: [RecordsController] })
export class RecordsModule {}
