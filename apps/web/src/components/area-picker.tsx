'use client';

import { INDIAN_STATES } from '@okidoc/shared';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import { Button, Field, Input, Select } from './ui';

export interface AreaRow {
  id: string;
  name: string;
  pin: string;
  region: { district: string; state: string };
}

const PIN_RE = /^[1-9]\d{5}$/;

/**
 * Clinic area: search the list (name, PIN, district or state). A clinic whose locality is missing adds it — any
 * state in India; the API reuses an existing area with the same name and PIN.
 */
export function AreaPicker({ areaId, pin, onPick }: { areaId?: string; pin?: string; onPick: (a: AreaRow) => void }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [na, setNa] = useState({ name: '', pin: '', district: '', state: '' });
  const term = q.trim();
  const results = useApi<AreaRow[]>(['areas', term], term ? `/areas?q=${encodeURIComponent(term)}` : null);
  const current = useApi<AreaRow[]>(['areas', 'id', areaId ?? ''], areaId ? `/areas?id=${encodeURIComponent(areaId)}` : null);
  const selected = current.data?.[0];
  const add = useAction((body: typeof na) => api<AreaRow>('/areas', { body }), { invalidate: [['areas']], success: (a) => `Area added: ${a.name}` });
  const canAdd = na.name.trim().length > 1 && PIN_RE.test(na.pin) && na.district.trim().length > 1 && !!na.state;

  const startAdding = () => {
    setNa({
      name: /^\d+$/.test(term) ? '' : term,
      pin: /^\d{6}$/.test(term) ? term : (pin ?? ''),
      district: '',
      state: selected?.region.state ?? '',
    });
    setAdding(true);
  };

  return (
    <div className="space-y-2">
      <Field label="Area">
        {selected && (
          <div className="mb-2 rounded-xl bg-teal-50 px-3 py-2 text-sm">
            <span className="font-bold text-slate-900">{selected.name} · {selected.pin}</span>
            <span className="text-slate-500"> — {selected.region.district}, {selected.region.state}</span>
          </div>
        )}
        {!adding && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={selected ? 'Search to change area' : 'Search your area, PIN or district'} />}
      </Field>

      {!adding && term && (
        <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
          {results.data?.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">No area matches “{term}”.</p>}
          {results.data?.slice(0, 30).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onPick(a);
                setQ('');
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-teal-50 ${a.id === areaId ? 'bg-teal-50 font-bold' : ''}`}
            >
              {a.name} · {a.pin} <span className="text-slate-500">— {a.region.district}, {a.region.state}</span>
            </button>
          ))}
        </div>
      )}

      {!adding && (
        <button type="button" onClick={startAdding} className="text-sm font-bold text-teal-700 hover:underline">
          + Can’t find your area? Add it
        </button>
      )}

      {adding && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="font-bold text-slate-900">Add your area</p>
          <p className="mb-3 text-sm text-slate-500">Patients will find your clinic under this area.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Area / locality"><Input value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value })} placeholder="e.g. Lake Town" /></Field>
            <Field label="PIN code" error={na.pin.length === 6 && !PIN_RE.test(na.pin) ? 'Enter a valid PIN code' : undefined}>
              <Input value={na.pin} inputMode="numeric" maxLength={6} onChange={(e) => setNa({ ...na, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            </Field>
            <Field label="District"><Input value={na.district} onChange={(e) => setNa({ ...na, district: e.target.value })} placeholder="e.g. North 24 Parganas" /></Field>
            <Field label="State">
              <Select value={na.state} onChange={(e) => setNa({ ...na, state: e.target.value })}>
                <option value="">Choose…</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button tone="ghost" type="button" onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={!canAdd}
              loading={add.isPending}
              onClick={() =>
                add.mutate(
                  { name: na.name.trim(), pin: na.pin, district: na.district.trim(), state: na.state },
                  {
                    onSuccess: (a) => {
                      onPick(a);
                      setAdding(false);
                      setQ('');
                    },
                  },
                )
              }
            >
              Add area
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
