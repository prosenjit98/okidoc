'use client';

import { use } from 'react';
import { Card, ErrorBox, PageHeader, Spinner, Stats, Table } from '@/components/ui';
import { dt } from '@/lib/format';
import { useApi } from '@/lib/hooks';

interface ClinicReviews {
  ratingAvg: number | null;
  ratingCount: number;
  breakdown: Record<string, number>;
  reviews: { id: string; clinicRating: number | null; doctorRating: number | null; doctor: string; comment: string | null; by: string; createdAt: string }[];
}

const stars = (n: number | null) => (n ? <span className="text-amber-500">{'★'.repeat(n) + '☆'.repeat(5 - n)}</span> : <span className="text-slate-400">—</span>);

/** PAT-16 (clinic side): the clinic's rating from patients, the star breakdown and recent reviews. */
export default function ClinicReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, isLoading } = useApi<ClinicReviews>(['clinic', id, 'reviews'], `/clinic/${id}/reviews`);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !data) return <Spinner />;
  const max = Math.max(1, ...Object.values(data.breakdown));
  return (
    <>
      <PageHeader
        title="Ratings & reviews"
        subtitle="After a visit is marked served, patients can rate your clinic (waiting time, cleanliness, staff, queue handling) and the doctor they saw. Okidoc moderates reviews; patients are shown by first name only."
      />
      <Stats
        items={[
          { label: 'Clinic rating', value: data.ratingAvg ? `★ ${data.ratingAvg.toFixed(1)}` : 'Not rated', icon: 'star' },
          { label: 'Clinic ratings', value: data.ratingCount, icon: 'users' },
          { label: 'Reviews with a comment', value: data.reviews.filter((r) => r.comment).length, icon: 'mail' },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Star breakdown" icon="star">
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-3 text-sm">
                <span className="w-8">{n} ★</span>
                <div className="h-2 flex-1 rounded bg-slate-100">
                  <div className="h-2 rounded bg-amber-400" style={{ width: `${(100 * (data.breakdown[n] ?? 0)) / max}%` }} />
                </div>
                <span className="w-8 text-right text-slate-500">{data.breakdown[n] ?? 0}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Recent reviews" icon="heart" className="lg:col-span-2">
          <Table
            rows={data.reviews}
            empty="No ratings yet. Patients can rate after their visit is marked as served."
            cols={[
              { h: 'Clinic', c: (r) => stars(r.clinicRating) },
              { h: 'Doctor', c: (r) => (<div><div>{stars(r.doctorRating)}</div><div className="text-xs text-slate-500">Dr. {r.doctor}</div></div>) },
              { h: 'Comment', c: (r) => r.comment ?? '—', className: 'w-2/5' },
              { h: 'By', c: (r) => `${r.by} · ${dt(r.createdAt)}` },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
