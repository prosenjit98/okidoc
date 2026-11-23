import { INDIAN_STATES, type IndianState } from './constants';

/** "  lake   TOWN " → "Lake Town"; mixed-case input ("McLeod Ganj") is kept as typed. */
export const tidyPlace = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t === t.toLowerCase() || t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : t;
};

const stateKey = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
const STATE_BY_KEY = new Map<string, IndianState>(INDIAN_STATES.map((s) => [stateKey(s), s]));
// Common short forms and older names seen in postal data.
for (const [alias, s] of [
  ['nctofdelhi', 'Delhi'],
  ['newdelhi', 'Delhi'],
  ['orissa', 'Odisha'],
  ['pondicherry', 'Puducherry'],
  ['uttaranchal', 'Uttarakhand'],
  ['jammuandkashmir', 'Jammu and Kashmir'],
  ['andamanandnicobar', 'Andaman and Nicobar Islands'],
  ['dadraandnagarhaveli', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['damananddiu', 'Dadra and Nagar Haveli and Daman and Diu'],
] as const) {
  if (!STATE_BY_KEY.has(alias)) STATE_BY_KEY.set(alias, s as IndianState);
}

/** Official state / UT name for loosely typed input ("west bengal", "Orissa", "Jammu & Kashmir"), or null. */
export const matchIndianState = (s: string): IndianState | null => STATE_BY_KEY.get(stateKey(s)) ?? null;

/** RFC 4180-style CSV: quoted fields, "" escapes, commas/newlines inside quotes, CRLF, leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Columns of the areas CSV. `area`, `pin`, `district`, `state` are required; header names are matched loosely. */
export const AREA_CSV_COLUMNS = ['area', 'pin', 'district', 'state', 'area_bn', 'lat', 'lng', 'active'] as const;
export type AreaCsvColumn = (typeof AREA_CSV_COLUMNS)[number];
const REQUIRED: AreaCsvColumn[] = ['area', 'pin', 'district', 'state'];
const HEADER_ALIASES: Record<string, AreaCsvColumn> = {
  area: 'area',
  areaname: 'area',
  name: 'area',
  locality: 'area',
  officename: 'area',
  pin: 'pin',
  pincode: 'pin',
  postalcode: 'pin',
  district: 'district',
  districtname: 'district',
  state: 'state',
  statename: 'state',
  areabn: 'area_bn',
  namebn: 'area_bn',
  bengali: 'area_bn',
  bengaliname: 'area_bn',
  lat: 'lat',
  latitude: 'lat',
  lng: 'lng',
  lon: 'lng',
  long: 'lng',
  longitude: 'lng',
  active: 'active',
};

export const AREA_CSV_TEMPLATE = 'area,pin,district,state,area_bn,lat,lng,active\nLake Town,700089,Kolkata,West Bengal,লেক টাউন,22.6045,88.4041,yes\nAnna Nagar,600040,Chennai,Tamil Nadu,,,,\n';

/** One data row of the CSV, as text, with its 1-based line number in the file. */
export type AreaCsvRow = { line: number } & Partial<Record<AreaCsvColumn, string>>;

/**
 * Read an areas CSV. Header problems are fatal (`error`); row problems are left to the server, except rows that repeat
 * an earlier row of the same file (`duplicates`: line → first line), which the server cannot see across batches.
 */
export function readAreasCsv(text: string): { rows: AreaCsvRow[]; duplicates: Record<number, number>; error?: string } {
  const table = parseCsv(text);
  const headerAt = table.findIndex((r) => r.some((c) => c.trim()));
  if (headerAt < 0) return { rows: [], duplicates: {}, error: 'The file is empty.' };
  const cols = table[headerAt].map((h) => HEADER_ALIASES[h.toLowerCase().replace(/[^a-z]/g, '')] ?? null);
  const missing = REQUIRED.filter((c) => !cols.includes(c));
  if (missing.length) return { rows: [], duplicates: {}, error: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. The first row must be the header: ${AREA_CSV_COLUMNS.join(',')}` };
  const rows: AreaCsvRow[] = [];
  const duplicates: Record<number, number> = {};
  const seen = new Map<string, number>();
  table.slice(headerAt + 1).forEach((r, i) => {
    if (!r.some((c) => c.trim())) return;
    const row: AreaCsvRow = { line: headerAt + i + 2 };
    cols.forEach((c, j) => {
      const v = r[j]?.trim();
      if (c && v) row[c] = v;
    });
    const key = areaKey(row.state ?? '', row.district ?? '', row.pin ?? '', row.area ?? '');
    const first = seen.get(key);
    if (first) duplicates[row.line] = first;
    else seen.set(key, row.line);
    rows.push(row);
  });
  return { rows, duplicates };
}

/** Identity of an area: same state, district, PIN and name (ignoring case and spacing). */
export const areaKey = (state: string, district: string, pin: string, name: string) =>
  [matchIndianState(state) ?? stateKey(state), tidyPlace(district).toLowerCase(), pin.trim(), tidyPlace(name).toLowerCase()].join('|');

/** "yes"/"no", "true"/"false", "1"/"0", "active"/"inactive"; anything else → undefined. */
export const parseYesNo = (s?: string): boolean | undefined => {
  const v = s?.trim().toLowerCase();
  if (!v) return undefined;
  if (['yes', 'y', 'true', '1', 'active'].includes(v)) return true;
  if (['no', 'n', 'false', '0', 'inactive'].includes(v)) return false;
  return undefined;
};
