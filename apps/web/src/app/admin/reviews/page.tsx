'use client';

import { useState } from 'react';
import { Badge, Button, Card, PageHeader, Table, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** Stars for a 1–5 rating; a dash when that part of the visit wasn't rated. */
const stars = (n?: number | null) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : <span className="text-slate-400">not rated</span>);

/** ADM-13 review moderation (doctor and clinic ratings, PAT-16). */
export default function ReviewsPage() {
  const [filter, setFilter] = useState('all');
  const { data } = useApi<any[]>(['admin', 'reviews', filter], `/admin/reviews?filter=${filter}`);
  const mod = useAction((v: { id: string; hidden: boolean }) => api(`/admin/reviews/${v.id}`, { method: 'PATCH', body: { hidden: v.hidden } }), { invalidate: [['admin', 'reviews']], success: 'Updated — doctor and clinic ratings recalculated' });
  return (
    <>
      <PageHeader title="Reviews" />
      <Tabs value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'All' }, { id: 'reported', label: 'Reported' }, { id: 'hidden', label: 'Hidden' }]} />
      <Card>
        <Table
          rows={data}
          empty="No reviews."
          cols={[
            { h: 'Doctor', c: (r: any) => (<div><div>Dr. {r.doctor.user.name}</div><div className="text-amber-500">{stars(r.rating)}</div></div>) },
            { h: 'Clinic', c: (r: any) => (<div><div>{r.clinic.name}</div><div className="text-amber-500">{stars(r.clinicRating)}</div></div>) },
            { h: 'Comment', c: (r: any) => r.comment ?? '—', className: 'w-2/5' },
            { h: 'By', c: (r: any) => `${r.user.name} · ${dt(r.createdAt)}` },
            { h: '', c: (r: any) => (<div className="flex items-center gap-2">{r.reports > 0 && <Badge tone="warn">{r.reports} reports</Badge>}<Button tone="outline" onClick={() => mod.mutate({ id: r.id, hidden: !r.hidden })}>{r.hidden ? 'Restore' : 'Hide'}</Button></div>) },
          ]}
        />
      </Card>
    </>
  );
}
