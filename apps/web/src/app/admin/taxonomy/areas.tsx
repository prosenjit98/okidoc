'use client';

import { AREA_BULK_MAX_ROWS, AREA_CSV_TEMPLATE, INDIAN_STATES, readAreasCsv, type AreaCsvRow } from '@okidoc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, Select, Table, Toggle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAction, useApi, useToast } from '@/lib/hooks';

interface AdminArea {
  id: string;
  name: string;
  nameBn: string | null;
  pin: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
  region: { district: string; state: string };
  _count: { clinics: number; users: number };
}

const PAGE = 100;
const PIN_RE = /^[1-9]\d{5}$/;
const MAX_FILE_ROWS = 50_000;

/** ADM-10 areas & PIN codes: search every area (inactive too), add or correct one, or upload many from a CSV. */
export function Areas() {
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [status, setStatus] = useState('all');
  const [skip, setSkip] = useState(0);
  const [editing, setEditing] = useState<AdminArea | 'new' | null>(null);
  const [bulk, setBulk] = useState(false);
  const params = new URLSearchParams({ q: q.trim(), state, status, skip: String(skip) });
  const { data } = useApi<{ total: number; items: AdminArea[] }>(['admin-areas', q.trim(), state, status, skip], `/admin/areas?${params}`);
  const toggle = useAction((v: { id: string; active: boolean }) => api(`/admin/areas/${v.id}`, { method: 'PATCH', body: { active: v.active } }), {
    invalidate: [['admin-areas'], ['areas']],
  });
  const filter = (f: () => void) => {
    f();
    setSkip(0);
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Field label="Search">
            <Input placeholder="Area, PIN or district" value={q} onChange={(e) => filter(() => setQ(e.target.value))} />
          </Field>
        </div>
        <Field label="State">
          <Select value={state} onChange={(e) => filter(() => setState(e.target.value))}>
            <option value="">All states</option>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => filter(() => setStatus(e.target.value))}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Button tone="outline" onClick={() => setBulk(true)}>
          Upload CSV
        </Button>
        <Button onClick={() => setEditing('new')}>Add area</Button>
      </div>
      <Table
        rows={data?.items}
        empty="No areas match"
        cols={[
          { h: 'Area', c: (a) => (<div><div className="font-semibold">{a.name}</div>{a.nameBn && <div className="text-xs text-slate-500">{a.nameBn}</div>}</div>) },
          { h: 'PIN', c: (a) => a.pin },
          { h: 'District', c: (a) => `${a.region.district}, ${a.region.state}` },
          { h: 'Used by', c: (a) => <span className="text-xs text-slate-600">{a._count.clinics} clinics · {a._count.users} people</span> },
          { h: 'Active', c: (a) => <Toggle checked={a.active} onChange={(active) => toggle.mutate({ id: a.id, active })} /> },
          { h: '', c: (a) => <Button tone="ghost" onClick={() => setEditing(a)}>Edit</Button>, className: 'text-right' },
        ]}
      />
      {!!data?.total && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            {skip + 1}–{Math.min(skip + PAGE, data.total)} of {data.total.toLocaleString('en-IN')} areas
          </span>
          <div className="flex gap-2">
            <Button tone="outline" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Previous</Button>
            <Button tone="outline" disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)}>Next</Button>
          </div>
        </div>
      )}
      {editing && <AreaModal area={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {bulk && <BulkModal onClose={() => setBulk(false)} />}
    </Card>
  );
}

/* ------------------------------------------------------------------ add / edit one area */

function AreaModal({ area, onClose }: { area: AdminArea | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: area?.name ?? '',
    nameBn: area?.nameBn ?? '',
    pin: area?.pin ?? '',
    district: area?.region.district ?? '',
    state: area?.region.state ?? 'West Bengal',
    lat: area?.lat != null ? String(area.lat) : '',
    lng: area?.lng != null ? String(area.lng) : '',
    active: area?.active ?? true,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const lat = f.lat.trim() ? Number(f.lat) : null;
  const lng = f.lng.trim() ? Number(f.lng) : null;
  const errors = {
    name: f.name.trim().length < 2 ? 'Enter the area name' : undefined,
    pin: !PIN_RE.test(f.pin) ? 'Enter a valid 6-digit PIN code' : undefined,
    district: f.district.trim().length < 2 ? 'Enter the district' : undefined,
    lat: lat != null && (Number.isNaN(lat) || lat < -90 || lat > 90) ? 'Between -90 and 90' : (lat == null) !== (lng == null) ? 'Give both, or neither' : undefined,
    lng: lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180) ? 'Between -180 and 180' : undefined,
  };
  const ok = !Object.values(errors).some(Boolean);
  const body = { name: f.name, nameBn: f.nameBn.trim(), pin: f.pin, district: f.district, state: f.state, lat, lng, active: f.active };
  const save = useAction(() => (area ? api(`/admin/areas/${area.id}`, { method: 'PATCH', body }) : api('/admin/areas', { body })), {
    invalidate: [['admin-areas'], ['areas']],
    success: (a: any) => (area ? `Saved ${a.name}` : `Added ${a.name}`),
  });
  const used = area ? area._count.clinics + area._count.users : 0;
  return (
    <Modal open title={area ? `Edit ${area.name}` : 'Add an area'} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Area name" error={f.name ? errors.name : undefined}><Input value={f.name} onChange={set('name')} placeholder="Lake Town" /></Field>
        <Field label="বাংলা name (optional)"><Input value={f.nameBn} onChange={set('nameBn')} /></Field>
        <Field label="PIN code" error={f.pin ? errors.pin : undefined}>
          <Input value={f.pin} maxLength={6} inputMode="numeric" onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="District" error={f.district ? errors.district : undefined}><Input value={f.district} onChange={set('district')} /></Field>
        <Field label="State / UT">
          <Select value={f.state} onChange={set('state')}>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end gap-3 pb-2">
          <Toggle checked={f.active} onChange={(active) => setF({ ...f, active })} label="Active" />
          <span className="text-sm text-slate-600">{f.active ? 'Active — clinics and patients can pick it' : 'Inactive — hidden from new choices'}</span>
        </div>
        <Field label="Latitude (optional)" error={errors.lat}><Input value={f.lat} onChange={set('lat')} inputMode="decimal" placeholder="22.6045" /></Field>
        <Field label="Longitude (optional)" error={errors.lng}><Input value={f.lng} onChange={set('lng')} inputMode="decimal" placeholder="88.4041" /></Field>
      </div>
      {used > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Used by {area!._count.clinics} clinics and {area!._count.users} people. They will see the changes; turning it inactive only hides it from new choices.
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button tone="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!ok} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
          {area ? 'Save' : 'Add area'}
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ CSV upload */

type RowStatus = 'new' | 'updated' | 'unchanged' | 'error';
interface ReportRow {
  line: number;
  status: RowStatus;
  message?: string;
  name?: string;
  pin?: string;
  district?: string;
  state?: string;
}
interface BulkResult {
  dryRun: boolean;
  counts: Record<RowStatus, number>;
  rows: ReportRow[];
}

const STATUS_LABEL: Record<RowStatus, string> = { new: 'New', updated: 'Update', unchanged: 'Already listed', error: 'Problem' };
const STATUS_TONE: Record<RowStatus, 'ok' | 'info' | 'muted' | 'bad'> = { new: 'ok', updated: 'info', unchanged: 'muted', error: 'bad' };

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Sends the rows in batches the API accepts; rows repeating an earlier row of the file are reported here. */
async function runBulk(rows: AreaCsvRow[], duplicates: Record<number, number>, dryRun: boolean, onProgress: (done: number) => void): Promise<BulkResult> {
  const send = rows.filter((r) => !duplicates[r.line]);
  const out: ReportRow[] = rows
    .filter((r) => duplicates[r.line])
    .map((r) => ({ line: r.line, status: 'error', message: `Repeats line ${duplicates[r.line]}`, name: r.area, pin: r.pin, district: r.district, state: r.state }));
  for (let i = 0; i < send.length; i += AREA_BULK_MAX_ROWS) {
    const res = await api<BulkResult>('/admin/areas/bulk', { body: { dryRun, rows: send.slice(i, i + AREA_BULK_MAX_ROWS) } });
    out.push(...res.rows);
    onProgress(Math.min(i + AREA_BULK_MAX_ROWS, send.length));
  }
  out.sort((a, b) => a.line - b.line);
  const counts = { new: 0, updated: 0, unchanged: 0, error: 0 };
  for (const r of out) counts[r.status]++;
  return { dryRun, counts, rows: out };
}

function BulkModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; rows: AreaCsvRow[]; duplicates: Record<number, number> } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<BulkResult | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [show, setShow] = useState<RowStatus | 'all'>('error');

  const run = async (rows: AreaCsvRow[], duplicates: Record<number, number>, dryRun: boolean) => {
    setBusy({ label: dryRun ? 'Checking' : 'Importing', done: 0, total: rows.length });
    try {
      return await runBulk(rows, duplicates, dryRun, (done) => setBusy((b) => b && { ...b, done }));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Upload failed', 'bad');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const pick = async (f: File) => {
    setPreview(null);
    setResult(null);
    setFile(null);
    setFileError(null);
    const parsed = readAreasCsv(await f.text());
    if (parsed.error) return setFileError(parsed.error);
    if (!parsed.rows.length) return setFileError('The file has a header but no rows.');
    if (parsed.rows.length > MAX_FILE_ROWS) return setFileError(`The file has ${parsed.rows.length.toLocaleString('en-IN')} rows. Split it into files of up to ${MAX_FILE_ROWS.toLocaleString('en-IN')} rows.`);
    setFile({ name: f.name, ...parsed });
    const p = await run(parsed.rows, parsed.duplicates, true);
    if (p) {
      setPreview(p);
      setShow(p.counts.error ? 'error' : p.counts.new ? 'new' : 'all');
    }
  };

  const importNow = async () => {
    if (!file) return;
    const r = await run(file.rows, file.duplicates, false);
    if (r) {
      setResult(r);
      setShow(r.counts.error ? 'error' : 'all');
      qc.invalidateQueries({ queryKey: ['admin-areas'] });
      qc.invalidateQueries({ queryKey: ['areas'] });
      qc.invalidateQueries({ queryKey: ['regions'] });
      toast(`Imported: ${r.counts.new} new, ${r.counts.updated} updated`, 'ok');
    }
  };

  const shown = result ?? preview;
  const visible = shown ? (show === 'all' ? shown.rows : shown.rows.filter((r) => r.status === show)) : [];
  const todo = preview ? preview.counts.new + preview.counts.updated : 0;

  return (
    <Modal open wide title="Upload areas from CSV" onClose={busy ? () => {} : onClose}>
      <div className="space-y-4 text-sm">
        <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">
          <p>
            Columns: <code className="font-semibold">area, pin, district, state</code> (required) and <code>area_bn, lat, lng, active</code> (optional). Names are tidied; the
            state can be written loosely (&quot;west bengal&quot;, &quot;Orissa&quot;). An area already listed with the same name, PIN and district is not added again — its
            Bengali name, location and active flag are updated when the file gives them.
          </p>
          <Button tone="outline" className="mt-3" onClick={() => downloadText(AREA_CSV_TEMPLATE, 'okidoc-areas-template.csv')}>
            Download template
          </Button>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-4 hover:border-teal-300">
          <span>{file ? <><b>{file.name}</b> · {file.rows.length.toLocaleString('en-IN')} rows</> : 'Choose a .csv file (UTF-8; save from Excel as “CSV UTF-8”)'}</span>
          <span className="font-semibold text-teal-700">{file ? 'Choose another' : 'Browse'}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) pick(f);
            }}
          />
        </label>
        {fileError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">{fileError}</p>}
        {busy && (
          <p className="text-slate-600">
            {busy.label} {busy.done.toLocaleString('en-IN')} / {busy.total.toLocaleString('en-IN')} rows…
          </p>
        )}

        {shown && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-navy-900">{result ? 'Imported:' : 'Preview — nothing saved yet:'}</span>
              {(['error', 'new', 'updated', 'unchanged', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setShow(s)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${show === s ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-slate-700 ring-slate-200'}`}
                >
                  {s === 'all' ? `All ${shown.rows.length}` : `${STATUS_LABEL[s]} ${shown.counts[s]}`}
                </button>
              ))}
              <Button
                tone="ghost"
                className="ml-auto"
                onClick={() =>
                  downloadText(
                    ['line,result,message,area,pin,district,state', ...shown.rows.map((r) => [r.line, STATUS_LABEL[r.status], r.message, r.name, r.pin, r.district, r.state].map(csvCell).join(','))].join('\n'),
                    `${(file?.name ?? 'areas').replace(/\.csv$/i, '')}-${result ? 'result' : 'check'}.csv`,
                  )
                }
              >
                Download report
              </Button>
            </div>
            <div className="max-h-[38vh] overflow-y-auto rounded-2xl border border-slate-100">
              <Table
                rows={visible.slice(0, 300)}
                empty="No rows here"
                cols={[
                  { h: 'Line', c: (r) => r.line },
                  { h: 'Result', c: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
                  { h: 'Area', c: (r) => `${r.name ?? '—'} · ${r.pin ?? '—'}` },
                  { h: 'District', c: (r) => [r.district, r.state].filter(Boolean).join(', ') || '—' },
                  { h: 'Note', c: (r) => <span className={r.status === 'error' ? 'text-rose-700' : 'text-slate-500'}>{r.message ?? ''}</span> },
                ]}
              />
            </div>
            {visible.length > 300 && <p className="text-xs text-slate-500">Showing the first 300 of {visible.length.toLocaleString('en-IN')}. Download the report for all rows.</p>}
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {preview && !result && preview.counts.error > 0 && todo > 0 && <span className="mr-auto text-xs text-amber-700">Rows with problems will be skipped.</span>}
          <Button tone="ghost" disabled={!!busy} onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <Button disabled={!preview || !todo || !!busy} loading={busy?.label === 'Importing'} onClick={importNow}>
              {preview && todo ? `Import ${preview.counts.new} new${preview.counts.updated ? ` · ${preview.counts.updated} updates` : ''}` : 'Import'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
