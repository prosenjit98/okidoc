'use client';

import { AD_PLACEMENTS } from '@okidoc/shared';
import { useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Stats, Table, Textarea, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { dOnly, inr, rupeesToPaise, todayIST } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

const PLACEMENT: Record<string, string> = {
  HOME_BANNER: 'Home banner',
  HOME_NATIVE: 'Home native card',
  POST_BOOKING_INTERSTITIAL: 'After booking (max once a day)',
  SEARCH_SPONSORED: 'Search “Sponsored” slot',
};

/** ADM-16 / MON-02 / MON-03 ads manager. */
export default function AdsPage() {
  const { data: placements } = useApi<any[]>(['admin', 'ads', 'placements'], '/admin/ads/placements');
  const { data: campaigns } = useApi<any[]>(['admin', 'ads', 'campaigns'], '/admin/ads/campaigns');
  const { data: report } = useApi<any>(['admin', 'ads', 'report'], '/admin/ads/report?days=30');
  const { data: rules } = useApi<any>(['admin', 'rules'], '/admin/rules');
  const savePlacement = useAction((p: any) => api('/admin/ads/placements', { method: 'PUT', body: p }), { invalidate: [['admin', 'ads', 'placements']], success: 'Placement saved' });
  const saveCampaign = useAction((c: any) => (c.id ? api(`/admin/ads/campaigns/${c.id}`, { method: 'PATCH', body: c.body }) : api('/admin/ads/campaigns', { body: c.body })), {
    invalidate: [['admin', 'ads', 'campaigns']],
    success: 'Campaign saved',
  });
  const addRevenue = useAction((r: any) => api('/admin/ads/revenue', { body: r }), { invalidate: [['admin', 'ads', 'report']], success: 'Revenue recorded' });
  const [edit, setEdit] = useState<any | null>(null);
  const [rev, setRev] = useState({ date: todayIST(), source: 'ADMOB', amount: '', note: '' });
  if (!placements || !campaigns) return <Spinner />;
  return (
    <>
      <PageHeader
        title="Ads manager"
        subtitle="Ads run only in the patient app and never on queue, checkout, payment, OTP, passcode or records screens. Health data is never shared with ad networks."
        actions={<Button onClick={() => setEdit({ advertiser: '', title: '', body: '', ctaLabel: 'Know more', ctaUrl: '', imageUrl: '', category: 'DIAGNOSTICS', placements: ['HOME_BANNER'], startsAt: todayIST(), endsAt: todayIST(), priority: 10, active: true })}>New campaign</Button>}
      />
      {report && (
        <Stats
          items={[
            { label: 'Impressions (30 d)', value: report.impressions },
            { label: 'Clicks (30 d)', value: report.byPlacement.reduce((a: number, p: any) => a + p.clicks, 0) },
            { label: 'Revenue entered (30 d)', value: inr(report.totalRevenuePaise) },
            { label: 'eCPM', value: inr(report.eCpmPaise) },
          ]}
        />
      )}
      <Card title="Placements">
        <Table
          rows={placements}
          cols={[
            { h: 'Placement', c: (p: any) => PLACEMENT[p.key] },
            { h: 'On', c: (p: any) => <Toggle checked={p.enabled} onChange={(enabled) => savePlacement.mutate({ ...p, enabled })} /> },
            {
              h: 'Source',
              c: (p: any) => (
                <Select value={p.source} className="!w-48" onChange={(e) => savePlacement.mutate({ ...p, source: e.target.value })}>
                  <option value="HOUSE_THEN_ADMOB">Sponsored first, then AdMob</option>
                  <option value="HOUSE">Sponsored only</option>
                  <option value="ADMOB">AdMob only</option>
                </Select>
              ),
            },
            { h: 'AdMob unit (Android)', c: (p: any) => <Input defaultValue={p.admobUnitAndroid ?? ''} onBlur={(e) => e.target.value !== (p.admobUnitAndroid ?? '') && savePlacement.mutate({ ...p, admobUnitAndroid: e.target.value || null })} /> },
            { h: 'AdMob unit (iOS)', c: (p: any) => <Input defaultValue={p.admobUnitIos ?? ''} onBlur={(e) => e.target.value !== (p.admobUnitIos ?? '') && savePlacement.mutate({ ...p, admobUnitIos: e.target.value || null })} /> },
            { h: 'Cap / day', c: (p: any) => <Input type="number" className="!w-20" defaultValue={p.frequencyCapPerDay} onBlur={(e) => savePlacement.mutate({ ...p, frequencyCapPerDay: Number(e.target.value) || 0 })} /> },
            { h: 'Impr. / clicks', c: (p: any) => { const r = report?.byPlacement.find((x: any) => x.placement === p.key); return r ? `${r.impressions} / ${r.clicks}` : '—'; } },
          ]}
        />
      </Card>
      <Card title="Sponsored campaigns (direct)" className="mt-4">
        <Table
          rows={campaigns}
          onRow={(c: any) => setEdit({ ...c, startsAt: c.startsAt.slice(0, 10), endsAt: c.endsAt.slice(0, 10) })}
          cols={[
            { h: 'Campaign', c: (c: any) => (<div><div className="font-semibold">{c.title}</div><div className="text-xs text-slate-500">{c.advertiser} · {c.category}</div></div>) },
            { h: 'Placements', c: (c: any) => c.placements.map((p: string) => PLACEMENT[p]).join(', ') },
            { h: 'Dates', c: (c: any) => `${dOnly(c.startsAt)} – ${dOnly(c.endsAt)}` },
            { h: 'Priority', c: (c: any) => c.priority },
            { h: 'Impr. / clicks', c: (c: any) => `${c.impressions} / ${c.clicks}` },
            { h: 'Status', c: (c: any) => (rules?.blockedAdCategories?.includes(c.category) ? <Badge tone="bad">blocked category</Badge> : <Badge tone={c.active ? 'ok' : 'muted'}>{c.active ? 'active' : 'paused'}</Badge>) },
          ]}
        />
        {rules && <p className="mt-3 text-xs text-slate-500">Blocked categories (Business rules): {rules.blockedAdCategories.join(', ')}</p>}
      </Card>
      <Card title="Record ad revenue (from the AdMob console or direct deals)" className="mt-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Date"><Input type="date" value={rev.date} onChange={(e) => setRev({ ...rev, date: e.target.value })} /></Field>
          <Field label="Source">
            <Select value={rev.source} onChange={(e) => setRev({ ...rev, source: e.target.value })}>
              <option value="ADMOB">AdMob</option>
              <option value="DIRECT">Direct sponsor</option>
            </Select>
          </Field>
          <Field label="Amount ₹"><Input type="number" value={rev.amount} onChange={(e) => setRev({ ...rev, amount: e.target.value })} /></Field>
          <Field label="Note"><Input value={rev.note} onChange={(e) => setRev({ ...rev, note: e.target.value })} /></Field>
          <div className="flex items-end">
            <Button disabled={!rev.amount} onClick={() => addRevenue.mutate({ date: rev.date, source: rev.source, amountPaise: rupeesToPaise(rev.amount), note: rev.note || undefined })}>Add</Button>
          </div>
        </div>
        {report?.revenueEntries?.length > 0 && (
          <Table rows={report.revenueEntries} cols={[{ h: 'Date', c: (r: any) => r.date }, { h: 'Source', c: (r: any) => r.source }, { h: 'Amount', c: (r: any) => inr(r.amountPaise) }, { h: 'Note', c: (r: any) => r.note ?? '' }]} />
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit campaign' : 'New campaign'} wide>
        {edit && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Advertiser"><Input value={edit.advertiser} onChange={(e) => setEdit({ ...edit, advertiser: e.target.value })} /></Field>
              <Field label="Category" hint="Blocked categories are never served"><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value.toUpperCase() })} /></Field>
              <Field label="Title"><Input maxLength={80} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Image URL (optional)"><Input value={edit.imageUrl ?? ''} onChange={(e) => setEdit({ ...edit, imageUrl: e.target.value })} /></Field>
              <Field label="Button label"><Input value={edit.ctaLabel ?? ''} onChange={(e) => setEdit({ ...edit, ctaLabel: e.target.value })} /></Field>
              <Field label="Button link"><Input value={edit.ctaUrl ?? ''} onChange={(e) => setEdit({ ...edit, ctaUrl: e.target.value })} /></Field>
              <Field label="Starts"><Input type="date" value={edit.startsAt} onChange={(e) => setEdit({ ...edit, startsAt: e.target.value })} /></Field>
              <Field label="Ends"><Input type="date" value={edit.endsAt} onChange={(e) => setEdit({ ...edit, endsAt: e.target.value })} /></Field>
              <Field label="Priority (higher first)"><Input type="number" value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) })} /></Field>
              <Field label="Active"><div className="pt-2"><Toggle checked={edit.active} onChange={(active) => setEdit({ ...edit, active })} /></div></Field>
            </div>
            <Field label="Body"><Textarea rows={2} maxLength={200} value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            <Field label="Placements">
              <div className="flex flex-wrap gap-4 text-sm">
                {AD_PLACEMENTS.map((p) => (
                  <label key={p} className="flex items-center gap-2">
                    <input type="checkbox" checked={edit.placements.includes(p)} onChange={(e) => setEdit({ ...edit, placements: e.target.checked ? [...edit.placements, p] : edit.placements.filter((x: string) => x !== p) })} />
                    {PLACEMENT[p]}
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex justify-end">
              <Button
                loading={saveCampaign.isPending}
                onClick={() =>
                  saveCampaign.mutate(
                    {
                      id: edit.id,
                      body: {
                        advertiser: edit.advertiser,
                        title: edit.title,
                        body: edit.body || undefined,
                        imageUrl: edit.imageUrl || null,
                        ctaLabel: edit.ctaLabel || undefined,
                        ctaUrl: edit.ctaUrl || null,
                        category: edit.category,
                        placements: edit.placements,
                        areaIds: edit.areaIds ?? [],
                        startsAt: new Date(`${edit.startsAt}T00:00:00+05:30`).toISOString(),
                        endsAt: new Date(`${edit.endsAt}T23:59:59+05:30`).toISOString(),
                        active: edit.active,
                        priority: edit.priority,
                      },
                    },
                    { onSuccess: () => setEdit(null) },
                  )
                }
              >
                Save campaign
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
