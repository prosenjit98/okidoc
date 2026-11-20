'use client';

import { use } from 'react';
import { Badge, Card, Confirm, ErrorBox, PageHeader, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

/** CLN-27 patients blocked at this clinic after 3 missed pay-at-clinic bookings (BR-07). */
export default function ClinicBlocksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = ['clinic', id, 'blocks'];
  const { data, error } = useApi<any[]>(key, `/clinic/${id}/blocks`);
  const lift = useAction((v: { id: string; reason: string }) => api(`/clinic/${id}/blocks/${v.id}/lift`, { body: { reason: v.reason } }), { invalidate: [key], success: 'Block lifted' });
  return (
    <>
      <PageHeader title="Blocked patients" subtitle="Patients who booked and did not come 3 times can't book online at your clinic. They can still visit as walk-ins. Wrong no-show? Use “Undo no-show” on the same day in the queue." />
      <Card>
        {error ? <ErrorBox error={error} /> : (
          <Table
            rows={data}
            empty="No blocked patients."
            cols={[
              { h: 'Patient', c: (b: any) => b.patientName },
              { h: 'Phone', c: (b: any) => b.phone },
              { h: 'Reason', c: (b: any) => b.reason },
              { h: 'Since', c: (b: any) => dt(b.createdAt) },
              { h: 'Status', c: (b: any) => (b.active ? <Badge tone="bad">blocked</Badge> : <Badge>lifted · {b.liftReason}</Badge>) },
              { h: '', c: (b: any) => (b.active ? <Confirm label="Lift block" tone="primary" prompt="Reason" onConfirm={(reason) => lift.mutate({ id: b.id, reason })} /> : null) },
            ]}
          />
        )}
        <p className="mt-3 text-xs text-slate-500">Only Okidoc can lift blocks unless Okidoc has enabled clinic-level lifting. Patients can also appeal through Okidoc support.</p>
      </Card>
    </>
  );
}
