import { Prisma, PrismaClient } from '@prisma/client';
import { areaKey, areaSchema, matchIndianState, parseYesNo, tidyPlace, type AreaCsvRow } from '@okidoc/shared';

type Db = PrismaClient | Prisma.TransactionClient;

/** District within a state, matched ignoring case ("kolkata" finds "Kolkata"). */
export const findRegion = (db: Db, state: string, district: string) =>
  db.region.findFirst({ where: { state, district: { equals: district, mode: 'insensitive' } } });

export async function regionFor(db: Db, state: string, district: string) {
  return (await findRegion(db, state, district)) ?? db.region.create({ data: { state, district, name: district } });
}

/** Another area with the same name and PIN in the same district (the identity used everywhere). */
export const findSameArea = (db: Db, regionId: string, pin: string, name: string, notId?: string) =>
  db.area.findFirst({ where: { regionId, pin, name: { equals: name, mode: 'insensitive' }, ...(notId ? { id: { not: notId } } : {}) }, include: { region: true } });

export type AreaImportStatus = 'new' | 'updated' | 'unchanged' | 'error';
export interface AreaImportRow {
  line: number;
  status: AreaImportStatus;
  message?: string;
  name?: string;
  pin?: string;
  district?: string;
  state?: string;
}

const FIELD_MESSAGES: Record<string, string> = {
  name: 'Area name must be 2–60 characters',
  pin: 'PIN must be 6 digits and cannot start with 0',
  district: 'District must be 2–60 characters',
  nameBn: 'Bengali name must be at most 60 characters',
  lat: 'Latitude must be a number between -90 and 90',
  lng: 'Longitude must be a number between -180 and 180',
};

const num = (s?: string) => (s ? Number(s) : undefined);

/** One CSV row → a valid area, or the reason it is not. */
function readRow(row: AreaCsvRow) {
  if (!row.state) return { error: 'State is missing' };
  const state = matchIndianState(row.state);
  if (!state) return { error: `Unknown state or UT "${row.state}"` };
  const active = parseYesNo(row.active);
  if (row.active && active === undefined) return { error: `Active must be yes or no, not "${row.active}"` };
  const r = areaSchema.safeParse({
    name: tidyPlace(row.area ?? ''),
    pin: row.pin?.trim() ?? '',
    district: tidyPlace(row.district ?? ''),
    state,
    nameBn: row.area_bn?.replace(/\s+/g, ' ').trim() || undefined,
    lat: num(row.lat),
    lng: num(row.lng),
    active,
  });
  if (!r.success) {
    const field = String(r.error.issues[0]?.path[0] ?? '');
    return { error: FIELD_MESSAGES[field] ?? r.error.issues[0]?.message ?? 'Invalid row' };
  }
  if ((r.data.lat == null) !== (r.data.lng == null)) return { error: 'Give both latitude and longitude, or neither' };
  return { area: r.data };
}

/**
 * ADM-10 bulk areas: validate every row, match existing areas (same district, PIN and name), then — unless `dryRun` —
 * create the new ones (and their districts) and apply the Bengali name / location / active values given for existing ones.
 */
export async function importAreas(db: PrismaClient, rows: AreaCsvRow[], dryRun: boolean) {
  const report: AreaImportRow[] = [];
  const seen = new Map<string, number>();
  const valid: { line: number; key: string; area: NonNullable<ReturnType<typeof readRow>['area']> }[] = [];
  for (const row of rows) {
    const { area, error } = readRow(row);
    if (!area) {
      report.push({ line: row.line, status: 'error', message: error, name: row.area, pin: row.pin, district: row.district, state: row.state });
      continue;
    }
    const key = areaKey(area.state, area.district, area.pin, area.name);
    const first = seen.get(key);
    if (first) {
      report.push({ line: row.line, status: 'error', message: `Repeats line ${first}`, name: area.name, pin: area.pin, district: area.district, state: area.state });
      continue;
    }
    seen.set(key, row.line);
    valid.push({ line: row.line, key, area });
  }

  const regions = await db.region.findMany();
  const regionByKey = new Map(regions.map((r) => [`${r.state}|${r.district.toLowerCase()}`, r]));
  const existing = await db.area.findMany({ where: { pin: { in: [...new Set(valid.map((v) => v.area.pin))] } }, include: { region: true } });
  const existingByKey = new Map(existing.map((a) => [areaKey(a.region.state, a.region.district, a.pin, a.name), a]));

  const creates: typeof valid = [];
  const updates: { id: string; data: Prisma.AreaUpdateInput }[] = [];
  for (const v of valid) {
    const { area } = v;
    const base = { line: v.line, name: area.name, pin: area.pin, district: area.district, state: area.state };
    const old = existingByKey.get(v.key);
    if (!old) {
      const newDistrict = !regionByKey.has(`${area.state}|${area.district.toLowerCase()}`);
      report.push({ ...base, status: 'new', message: newDistrict ? `New district: ${area.district}, ${area.state}` : undefined });
      creates.push(v);
      continue;
    }
    const data: Prisma.AreaUpdateInput = {};
    const changed: string[] = [];
    if (area.nameBn && area.nameBn !== old.nameBn) (data.nameBn = area.nameBn), changed.push('Bengali name');
    if (area.lat != null && (area.lat !== old.lat || area.lng !== old.lng)) (data.lat = area.lat), (data.lng = area.lng), changed.push('map location');
    if (area.active !== undefined && area.active !== old.active) (data.active = area.active), changed.push(area.active ? 'made active' : 'made inactive');
    if (changed.length) {
      updates.push({ id: old.id, data });
      report.push({ ...base, name: old.name, district: old.region.district, status: 'updated', message: changed.join(', ') });
    } else report.push({ ...base, name: old.name, district: old.region.district, status: 'unchanged', message: 'Already in the list' });
  }

  if (!dryRun && (creates.length || updates.length)) {
    await db.$transaction(
      async (tx) => {
        for (const { area } of creates) {
          const k = `${area.state}|${area.district.toLowerCase()}`;
          if (!regionByKey.has(k)) regionByKey.set(k, await regionFor(tx, area.state, area.district));
        }
        await tx.area.createMany({
          data: creates.map(({ area }) => ({
            regionId: regionByKey.get(`${area.state}|${area.district.toLowerCase()}`)!.id,
            name: area.name,
            pin: area.pin,
            nameBn: area.nameBn ?? null,
            lat: area.lat ?? null,
            lng: area.lng ?? null,
            active: area.active ?? true,
          })),
        });
        for (const u of updates) await tx.area.update({ where: { id: u.id }, data: u.data });
      },
      { timeout: 60_000 },
    );
  }

  report.sort((a, b) => a.line - b.line);
  const count = (s: AreaImportStatus) => report.filter((r) => r.status === s).length;
  return { dryRun, counts: { new: count('new'), updated: count('updated'), unchanged: count('unchanged'), error: count('error') }, rows: report };
}
