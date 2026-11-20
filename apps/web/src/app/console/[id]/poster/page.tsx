'use client';

import { use, useState } from 'react';
import { Button, ErrorBox, Field, Input, Logo, PageHeader, Spinner } from '@/components/ui';
import { t12, todayIST, dOnly } from '@/lib/format';
import { useApi } from '@/lib/hooks';

/** CLN-24 Today's doctors poster — print it or save as PDF, or share the QR link. */
export default function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [date, setDate] = useState(todayIST());
  const { data, error } = useApi<any>(['clinic', id, 'poster', date], `/clinic/${id}/poster?date=${date}`);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  const shareText = `Doctors at ${data.clinic.name} on ${dOnly(data.date)}:\n${data.doctors.map((d: any) => `• Dr. ${d.name} (${d.specialties.join(', ')}) ${t12(d.startTime)}–${t12(d.endTime)}`).join('\n')}\nBook your serial on Okidoc: ${data.url}`;
  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Today's doctors poster"
          actions={
            <>
              <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Button className="self-end" onClick={() => window.print()}>Print / save PDF</Button>
              <a className="self-end" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}>
                <Button tone="outline">Share on WhatsApp</Button>
              </a>
            </>
          }
        />
      </div>
      <div className="mx-auto max-w-xl overflow-hidden rounded-[20px] bg-white shadow-lg print:shadow-none">
        <div className="hero-gradient p-6 text-white">
          <Logo light />
          <h2 className="mt-4 text-2xl font-bold">{data.clinic.name}</h2>
          <p className="text-sm text-slate-300">{data.clinic.address}, {data.clinic.area}</p>
          <p className="mt-2 text-sm font-semibold text-teal-300">Doctors sitting · {dOnly(data.date)}</p>
        </div>
        <div className="divide-y p-6">
          {data.doctors.length ? data.doctors.map((d: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div>
                <div className="text-lg font-semibold">Dr. {d.name}</div>
                <div className="text-sm text-slate-500">{d.specialties.join(', ')}</div>
              </div>
              <div className="text-right font-semibold text-teal-600">{t12(d.startTime)} – {t12(d.endTime)}</div>
            </div>
          )) : <p className="py-6 text-center text-slate-500">No doctors sitting on this date.</p>}
        </div>
        <div className="flex items-center gap-4 border-t bg-mint p-6">
          <img src={data.qrDataUrl} alt="Clinic QR" className="h-32 w-32" />
          <div>
            <p className="font-bold text-navy-900">Scan to book your serial</p>
            <p className="text-sm text-slate-600">Know your queue. Skip the wait.</p>
            <p className="mt-1 text-xs text-slate-500">Clinic code {data.clinic.code}{data.clinic.phone ? ` · ${data.clinic.phone}` : ''}</p>
          </div>
        </div>
      </div>
    </>
  );
}
