'use client';

import { FEATURE_KEYS, FEATURE_LABELS, LIMIT_KEYS } from '@okidoc/shared';
import { useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Spinner, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { inr, rupeesToPaise } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

type Plan = any;
const blank = { code: '', name: '', price: '0', yearly: '', trialDays: '0', features: {} as Record<string, boolean>, limits: {} as Record<string, number | null>, active: true, sortOrder: 0 };

/** ADM-18 subscription plans (feature tiers). */
export default function PlansPage() {
  const key = ['admin', 'plans'];
  const { data } = useApi<Plan[]>(key, '/admin/plans');
  const { data: rules } = useApi<any>(['admin', 'default-plan'], '/admin/rules');
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const save = useAction(
    (p: typeof blank & { id?: string }) => {
      const body = {
        code: p.code,
        name: p.name,
        priceMonthlyPaise: rupeesToPaise(p.price),
        priceYearlyPaise: p.yearly ? rupeesToPaise(p.yearly) : null,
        trialDays: Number(p.trialDays) || 0,
        features: p.features,
        limits: p.limits,
        active: p.active,
        sortOrder: p.sortOrder,
      };
      return p.id ? api(`/admin/plans/${p.id}`, { method: 'PATCH', body }) : api('/admin/plans', { body });
    },
    { invalidate: [key], success: 'Plan saved' },
  );
  const makeDefault = useAction((code: string) => api('/admin/plans/default', { body: { code } }), { success: 'Default plan changed for clinics without a plan' });
  if (!data) return <Spinner />;
  void rules;
  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="Plans set clinic features and limits. Billing for paid plans runs only when Clinic subscriptions are switched on."
        actions={<Button onClick={() => setEdit({ ...blank })}>New plan</Button>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {data.map((p) => (
          <Card key={p.id} title={p.name} actions={<Badge tone={p.active ? 'ok' : 'muted'}>{p.active ? 'active' : 'hidden'}</Badge>}>
            <p className="text-2xl font-bold">
              {p.priceMonthlyPaise ? inr(p.priceMonthlyPaise) : 'Free'}
              {p.priceMonthlyPaise ? <span className="text-sm font-normal text-slate-500"> / month</span> : null}
            </p>
            <p className="text-xs text-slate-500">
              {p.code} · {p._count.clinics} clinics · trial {p.trialDays} days
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {FEATURE_KEYS.map((k) => (
                <li key={k} className={p.features?.[k] ? 'text-navy-900' : 'text-slate-400 line-through'}>
                  {FEATURE_LABELS[k]}
                </li>
              ))}
              {LIMIT_KEYS.map((k) => (
                <li key={k} className="text-slate-600">
                  {FEATURE_LABELS[k]}: {p.limits?.[k] ?? 'unlimited'}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button
                tone="outline"
                onClick={() =>
                  setEdit({
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    price: String(p.priceMonthlyPaise / 100),
                    yearly: p.priceYearlyPaise ? String(p.priceYearlyPaise / 100) : '',
                    trialDays: String(p.trialDays),
                    features: p.features ?? {},
                    limits: p.limits ?? {},
                    active: p.active,
                    sortOrder: p.sortOrder,
                  })
                }
              >
                Edit
              </Button>
              <Button tone="ghost" onClick={() => makeDefault.mutate(p.code)}>
                Make default
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit plan' : 'New plan'} wide>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <Field label="Code">
                <Input value={edit.code} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Name">
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="₹ / month">
                <Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} />
              </Field>
              <Field label="₹ / year">
                <Input type="number" value={edit.yearly} onChange={(e) => setEdit({ ...edit, yearly: e.target.value })} />
              </Field>
              <Field label="Trial days">
                <Input type="number" value={edit.trialDays} onChange={(e) => setEdit({ ...edit, trialDays: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {FEATURE_KEYS.map((k) => (
                <label key={k} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                  {FEATURE_LABELS[k]}
                  <Toggle checked={!!edit.features[k]} onChange={(v) => setEdit({ ...edit, features: { ...edit.features, [k]: v } })} />
                </label>
              ))}
              {LIMIT_KEYS.map((k) => (
                <label key={k} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                  {FEATURE_LABELS[k]}
                  <Input
                    type="number"
                    className="!w-24"
                    placeholder="∞"
                    value={edit.limits[k] ?? ''}
                    onChange={(e) => setEdit({ ...edit, limits: { ...edit.limits, [k]: e.target.value === '' ? null : Number(e.target.value) } })}
                  />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Toggle checked={edit.active} onChange={(active) => setEdit({ ...edit, active })} /> Available to clinics
            </label>
            <div className="flex justify-end">
              <Button loading={save.isPending} disabled={!edit.code || !edit.name} onClick={() => save.mutate(edit, { onSuccess: () => setEdit(null) })}>
                Save plan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
