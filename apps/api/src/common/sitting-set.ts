import type { Prisma } from '@prisma/client';
import type { SittingInput } from '@okidoc/shared';
import { EntitlementsService } from '../modules/platform/platform.services';
import { todayIST } from '../modules/scheduling/scheduling.service';
import { sittingOutsideHours } from './hours';
import { bad, must } from './http';
import { PrismaService } from './prisma.service';

/**
 * Saves sittings from the day-by-day editor (one sitting per distinct time range) for one doctor at one clinic.
 * When editing (`editId`), that sitting is updated with the range matching its old time (else the first), so its
 * bookings stay attached; other ranges become new sittings. All-or-nothing: the plan limit is checked first.
 */
export async function saveSittingSet(
  prisma: PrismaService,
  entitlements: EntitlementsService,
  o: { clinicId: string; linkId: string; editId?: string; sittings: SittingInput[]; userId: string; weeklyHours: Prisma.JsonValue | null | undefined },
) {
  if (o.sittings.some((s) => s.endTime <= s.startTime)) throw bad('BAD_TIME', 'Each sitting must end after it starts');
  const existing = o.editId ? must(await prisma.sitting.findFirst({ where: { id: o.editId, linkId: o.linkId, active: true } }), 'Sitting') : null;
  let keep = -1;
  if (existing) {
    keep = o.sittings.findIndex((s) => s.startTime === existing.startTime && s.endTime === existing.endTime);
    if (keep < 0) keep = 0;
  }
  const creates = o.sittings.filter((_, i) => i !== keep);
  if (creates.length) {
    const count = await prisma.sitting.count({ where: { link: { clinicId: o.clinicId }, active: true } });
    await entitlements.requireWithinLimit(o.clinicId, 'MAX_SITTINGS', count + creates.length - 1);
  }
  const fields = (s: SittingInput) => ({ weekdays: s.weekdays, startTime: s.startTime, endTime: s.endTime, recurrence: s.recurrence, maxPatients: s.maxPatients ?? null });
  const saved = await prisma.$transaction([
    ...(existing ? [prisma.sitting.update({ where: { id: existing.id }, data: fields(o.sittings[keep]) })] : []),
    ...creates.map((s) =>
      prisma.sitting.create({ data: { ...fields(s), linkId: o.linkId, specificDates: s.specificDates ?? [], validFrom: s.validFrom ?? todayIST(), createdById: o.userId } }),
    ),
  ]);
  const outside = new Set<number>();
  for (const s of saved) for (const d of sittingOutsideHours(o.weeklyHours, s)) outside.add(d);
  return { saved: saved.length, created: creates.length, updated: existing ? 1 : 0, outsideHours: [...outside].sort() };
}
