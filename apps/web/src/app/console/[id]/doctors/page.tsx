'use client';

import { dayList } from '@okidoc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { use, useState } from 'react';
import { Badge, Button, Card, Confirm, cx, Empty, ErrorBox, Field, Hero, Input, Modal, PageHeader, Select, Spinner, Stats, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { days, inr, rupeesToPaise, t12, todayIST, WEEKDAYS } from '@/lib/format';
import { useAction, useApi, useRoom } from '@/lib/hooks';

/** CLN-03..07 doctors & sittings roster. */
export default function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const key = ['clinic', id, 'roster', q];
  const { data, error } = useApi<any>(key, `/clinic/${id}/doctors${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  useRoom(`clinic:${id}`, ['roster:changed'], () => qc.invalidateQueries({ queryKey: ['clinic', id, 'roster'] }));
  const inv = [['clinic', id, 'roster'], ['clinic', id]];
  const respond = useAction((v: { linkId: string; accept: boolean; reason?: string }) => api(`/clinic/${id}/links/${v.linkId}/respond`, { body: { accept: v.accept, reason: v.reason } }), { invalidate: inv, success: 'Saved' });
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Doctors & sittings" actions={<Button onClick={() => setAdding(true)}>+ Add doctor</Button>} />
      <Hero eyebrow="CHAMBER ROSTER" title="Every doctor. Every sitting. One calm view." hint="Tap a doctor to see or change their weekly chamber plan." />
      <Stats items={[{ label: 'Doctors', value: data.summary.doctors }, { label: 'Scheduled', value: data.summary.scheduled }, { label: 'Active days', value: data.summary.activeDays }]} />
      {data.requests.length > 0 && (
        <Card title={`Requests & changes · ${data.requests.length}`} className="mb-4 !border-red-100 !bg-red-50/40">
          <div className="space-y-2">
            {data.requests.map((r: any) => (
              <div key={r.linkId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
                <div>
                  <div className="font-semibold">Dr. {r.doctor.name}</div>
                  <div className="text-xs text-slate-500">
                    {r.status === 'DECLINED'
                      ? `This connection was declined, so no queue can run here. ${r.declineReason ?? ''} Send a new request if this was a mistake.`
                      : r.initiatedBy === 'DOCTOR'
                        ? 'Asked to sit at your clinic.'
                        : 'Waiting for the doctor to accept.'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.doctor.verification === 'APPROVED' ? r.status : 'PENDING'} />
                  {r.doctor.verification !== 'APPROVED' && <Badge tone="warn">doctor not verified yet</Badge>}
                  {r.status === 'PENDING' && r.initiatedBy === 'DOCTOR' && (
                    <>
                      <Button onClick={() => respond.mutate({ linkId: r.linkId, accept: true })}>Accept</Button>
                      <Confirm label="Decline" prompt="Reason (sent to the doctor)" onConfirm={(reason) => respond.mutate({ linkId: r.linkId, accept: false, reason })} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title={`Your doctors · ${data.doctors.length}`}>
        <Input placeholder="Search doctor or specialty" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
        {data.doctors.length === 0 ? (
          <Empty text="Build your chamber roster. Add a doctor once, then set the days and hours they sit here." action={<Button onClick={() => setAdding(true)}>Add first doctor</Button>} />
        ) : (
          <div className="space-y-2">
            {data.doctors.map((d: any) => (
              <DoctorRow key={d.linkId} clinicId={id} d={d} open={open === d.linkId} onToggle={() => setOpen(open === d.linkId ? null : d.linkId)} />
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">⚡ Saved changes refresh the Walk-in roster automatically — no app restart needed.</p>
      </Card>
      <AddDoctor clinicId={id} open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function DoctorRow({ clinicId, d, open, onToggle }: { clinicId: string; d: any; open: boolean; onToggle: () => void }) {
  const inv = [['clinic', clinicId, 'roster']];
  const [fee, setFee] = useState(String(d.consultationFee / 100));
  const [split, setSplit] = useState(String(d.clinicSplitPercent));
  const [walkIn, setWalkIn] = useState(d.walkInEvery ? String(d.walkInEvery) : '');
  const saveLink = useAction(() => api(`/clinic/${clinicId}/links/${d.linkId}`, { method: 'PATCH', body: { consultationFee: rupeesToPaise(fee), clinicSplitPercent: Number(split), walkInEvery: walkIn ? Number(walkIn) : null } }), { invalidate: inv, success: 'Saved' });
  const remove = useAction(() => api(`/clinic/${clinicId}/links/${d.linkId}`, { method: 'DELETE' }), { invalidate: inv, success: 'Doctor removed; future sittings cancelled' });
  const delSitting = useAction((sid: string) => api(`/clinic/${clinicId}/sittings/${sid}`, { method: 'DELETE' }), { invalidate: inv });
  const [sitting, setSitting] = useState<any | null>(null);
  const initials = d.doctor.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('');
  return (
    <div className="rounded-[14px] border border-slate-200">
      <button className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle}>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500 font-bold text-white">{initials}</div>
        <div className="flex-1">
          <div className="font-semibold">
            Dr. {d.doctor.name} {d.doctor.verification === 'APPROVED' && <span className="text-teal-500">✓</span>}
          </div>
          <div className="text-xs text-slate-500">
            {d.doctor.specialties.join(', ')} · {d.doctor.degrees}
          </div>
          <div className={cx('text-xs font-semibold', d.doctor.verification === 'APPROVED' ? 'text-green-600' : 'text-red-600')}>
            ● {d.doctor.verification === 'APPROVED' ? 'Approved by Okidoc' : 'Not approved'} · {d.sittings.length ? `${d.sittings.length} sittings` : 'Sitting needed'}
          </div>
        </div>
        <span className="text-slate-400">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Consultation fee ₹"><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
            <Field label="Clinic share %" hint="Rest goes to the doctor"><Input type="number" min={0} max={100} value={split} onChange={(e) => setSplit(e.target.value)} /></Field>
            <Field label="Reserve every Nth token for walk-ins" hint="Empty = no reservation (BR-01)"><Input type="number" min={2} max={10} value={walkIn} onChange={(e) => setWalkIn(e.target.value)} /></Field>
            <div className="flex items-end gap-2">
              <Button onClick={() => saveLink.mutate(undefined)}>Save</Button>
              <Confirm label="Remove doctor" prompt="Reason (future sittings are cancelled)" onConfirm={() => remove.mutate(undefined)} />
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Weekly chamber plan</h4>
              <Button tone="outline" onClick={() => setSitting({ weekdays: [1, 3, 5], startTime: '18:00', endTime: '20:00', maxPatients: '', recurrence: 'WEEKLY' })}>+ Add sitting</Button>
            </div>
            {d.sittings.length === 0 ? (
              <p className="text-sm text-slate-500">No sittings yet. Patients can book once you add one.</p>
            ) : (
              <div className="space-y-2">
                {d.sittings.map((s: any) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-mint p-3 text-sm">
                    <div>
                      <b>{days(s.weekdays)}</b> · {t12(s.startTime)} – {t12(s.endTime)}
                      {s.recurrence === 'ALTERNATE_WEEKS' && <Badge tone="info">alternate weeks</Badge>}
                      {s.maxPatients ? <span className="text-xs text-slate-500"> · max {s.maxPatients}</span> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button tone="ghost" onClick={() => setSitting({ ...s, maxPatients: s.maxPatients ?? '' })}>Edit</Button>
                      <Button tone="ghost" className="text-red-600" onClick={() => confirm('Remove this sitting?') && delSitting.mutate(s.id)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {sitting && <SittingModal key={sitting.id ?? 'new'} clinicId={clinicId} linkId={d.linkId} value={sitting} onClose={() => setSitting(null)} />}
          <p className="mt-3 text-xs text-slate-500">Fee {inr(d.consultationFee)} · avg consult {d.avgConsultMinutes ? `${d.avgConsultMinutes} min` : 'learning'}</p>
        </div>
      )}
    </div>
  );
}

function SittingModal({ clinicId, linkId, value, onClose }: { clinicId: string; linkId: string; value: any; onClose: () => void }) {
  const [v, setV] = useState<any>(value);
  const save = useAction(
    () => {
      const body = {
        weekdays: v.weekdays,
        startTime: v.startTime,
        endTime: v.endTime,
        recurrence: v.recurrence,
        maxPatients: v.maxPatients === '' ? null : Number(v.maxPatients),
        ...(v.recurrence === 'ALTERNATE_WEEKS' ? { anchorDate: v.anchorDate ?? todayIST() } : {}),
      };
      return v.id ? api(`/clinic/${clinicId}/sittings/${v.id}`, { method: 'PATCH', body }) : api(`/clinic/${clinicId}/links/${linkId}/sittings`, { body });
    },
    {
      invalidate: [['clinic', clinicId, 'roster']],
      // CLN-01a: saved either way, but say so when it falls outside the clinic's opening hours.
      success: (r: any) => (r?.outsideHours?.length ? `Sitting saved. Note: on ${dayList(r.outsideHours)} it is outside your opening hours.` : 'Sitting saved — the doctor is notified'),
    },
  );
  return (
    <Modal open onClose={onClose} title={v.id ? 'Edit sitting' : 'Add sitting'}>
      <Field label="Days">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setV({ ...v, weekdays: v.weekdays.includes(d) ? v.weekdays.filter((x: number) => x !== d) : [...v.weekdays, d] })}
              className={cx('rounded-full px-3 py-1.5 text-sm font-semibold', v.weekdays.includes(d) ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600')}
            >
              {WEEKDAYS[d]}
            </button>
          ))}
        </div>
      </Field>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Starts"><Input type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} /></Field>
        <Field label="Ends"><Input type="time" value={v.endTime} onChange={(e) => setV({ ...v, endTime: e.target.value })} /></Field>
        <Field label="Repeat">
          <Select value={v.recurrence} onChange={(e) => setV({ ...v, recurrence: e.target.value })}>
            <option value="WEEKLY">Every week</option>
            <option value="ALTERNATE_WEEKS">Alternate weeks</option>
          </Select>
        </Field>
        <Field label="Max patients (optional)"><Input type="number" min={1} value={v.maxPatients} onChange={(e) => setV({ ...v, maxPatients: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={!v.weekdays.length || v.endTime <= v.startTime} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
          Save sitting
        </Button>
      </div>
    </Modal>
  );
}

function AddDoctor({ clinicId, open, onClose }: { clinicId: string; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const { data: results } = useApi<any[]>(['clinic', clinicId, 'doctor-search', q], q.length >= 2 ? `/clinic/${clinicId}/doctors/search?q=${encodeURIComponent(q)}` : null);
  const [pick, setPick] = useState<any | null>(null);
  const [invite, setInvite] = useState('');
  const [fee, setFee] = useState('300');
  const [split, setSplit] = useState('20');
  const add = useAction(
    () =>
      api(`/clinic/${clinicId}/doctors`, {
        body: { ...(pick ? { doctorId: pick.id } : { invitePhone: invite }), consultationFee: rupeesToPaise(fee), clinicSplitPercent: Number(split) },
      }),
    {
      invalidate: [['clinic', clinicId, 'roster']],
      success: (r: any) => (r.invited ? 'Invitation sent by SMS with your clinic code' : 'Request sent — the doctor accepts in the Okidoc app'),
    },
  );
  const close = () => {
    setQ('');
    setPick(null);
    setInvite('');
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title="Add a doctor">
      {!pick ? (
        <>
          <Field label="Search Okidoc doctors" hint="Name, registration number or phone">
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {results?.map((d) => (
              <button key={d.id} onClick={() => setPick(d)} className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-teal-50">
                <span>
                  <b>Dr. {d.name}</b> <span className="text-xs text-slate-500">{d.specialties.join(', ')} · {d.degrees}</span>
                </span>
                <StatusBadge status={d.verification} />
              </button>
            ))}
            {results && !results.length && <p className="p-2 text-sm text-slate-500">No doctor found. Invite them by phone below.</p>}
          </div>
          <div className="mt-4 border-t pt-4">
            <Field label="…or invite by phone number"><Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="98300 12345" /></Field>
          </div>
        </>
      ) : (
        <p className="mb-3 rounded-xl bg-teal-50 p-3 text-sm">
          Dr. <b>{pick.name}</b> · {pick.specialties.join(', ')}{' '}
          <button className="text-teal-600" onClick={() => setPick(null)}>change</button>
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Consultation fee ₹"><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
        <Field label="Clinic share %"><Input type="number" value={split} onChange={(e) => setSplit(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={!pick && invite.replace(/\D/g, '').length < 10} loading={add.isPending} onClick={() => add.mutate(undefined, { onSuccess: close })}>
          {pick ? 'Send request' : 'Send invite'}
        </Button>
      </div>
    </Modal>
  );
}
