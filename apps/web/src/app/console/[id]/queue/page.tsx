'use client';

import { useQueryClient } from '@tanstack/react-query';
import { use, useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, cx, Empty, ErrorBox, Field, Icon, Input, Modal, Spinner, StatusBadge, Table, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { sittingLabel, t12, todayIST } from '@/lib/format';
import { useAction, useApi, useRoom } from '@/lib/hooks';
import { useClinic } from '../clinic-context';

type View = any;
const TILE: { id: string; label: string; tone: string; dot: string; match: (b: any) => boolean }[] = [
  { id: 'total', label: 'Total', tone: 'from-white to-slate-50 ring-slate-200', dot: 'bg-navy-900', match: (b) => b.status !== 'PENDING_PAYMENT' },
  { id: 'online', label: 'Online', tone: 'from-teal-50 to-white ring-teal-200', dot: 'bg-teal-500', match: (b) => b.source === 'ONLINE' && b.status !== 'PENDING_PAYMENT' },
  { id: 'walkIn', label: 'Walk-in', tone: 'from-sky-50 to-white ring-sky-200', dot: 'bg-sky-500', match: (b) => b.source !== 'ONLINE' },
  { id: 'present', label: 'Present', tone: 'from-emerald-50 to-white ring-emerald-200', dot: 'bg-emerald-500', match: (b) => ['PRESENT', 'IN_CONSULTATION', 'SERVED', 'SKIPPED'].includes(b.status) },
  { id: 'late', label: 'Late', tone: 'from-amber-50 to-white ring-amber-200', dot: 'bg-amber-500', match: (b) => b.status === 'LATE' },
  { id: 'cancelled', label: 'Cancelled', tone: 'from-rose-50 to-white ring-rose-200', dot: 'bg-rose-500', match: (b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW' },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const minutesUntil = (date: string, hm: string) => Math.round((Date.parse(`${date}T${hm}:00+05:30`) - Date.now()) / 60000);
const fmtIn = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

/** CLN-08..14 queue console (browser version). */
export default function QueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const clinic = useClinic();
  const qc = useQueryClient();
  const now = useClock();
  const [date, setDate] = useState(todayIST());
  const key = ['clinic', id, 'queue', date];
  const { data, error } = useApi<any>(key, `/clinic/${id}/queue?date=${date}`, { refetchInterval: 30_000 });
  useRoom(`clinic:${id}`, ['queue:update', 'bookings:changed', 'roster:changed'], () => qc.invalidateQueries({ queryKey: ['clinic', id, 'queue'] }));
  const [selId, setSelId] = useState<string | null>(null);
  const doctors: View[] = data?.doctors ?? [];
  const sel: View | undefined = doctors.find((d) => d.snapshot.instanceId === selId) ?? doctors.find((d) => d.snapshot.status === 'ONLINE') ?? doctors[0];

  const act = useAction((v: { action: string; delayMinutes?: number; reason?: string; moveLate?: boolean }) => api(`/clinic/${id}/instances/${sel!.snapshot.instanceId}/action`, { body: v }), { invalidate: [key] });
  const bAct = useAction((v: { bookingId: string; action: string; paidVia?: string; reason?: string }) => api(`/clinic/${id}/bookings/${v.bookingId}/action`, { body: { action: v.action, paidVia: v.paidVia, reason: v.reason } }), { invalidate: [key] });
  const [walk, setWalk] = useState({ name: '', phone: '' });
  const addWalk = useAction(() => api(`/clinic/${id}/instances/${sel!.snapshot.instanceId}/walk-ins`, { body: walk }), {
    invalidate: [key],
    success: (r: any) => `Token #${r.booking.tokenNo} for ${r.booking.patientName}`,
  });
  const [tile, setTile] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [delay, setDelay] = useState('15');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const [moveLate, setMoveLate] = useState(true);

  const tiles = useMemo(() => (sel ? TILE.map((t) => ({ ...t, rows: sel.bookings.filter(t.match) })) : []), [sel]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;

  const clock = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const s = sel?.snapshot;
  const closed = s && ['ENDED', 'CANCELLED'].includes(s.status);

  return (
    <>
      <div className="ok-aurora ok-rise relative mb-6 overflow-hidden rounded-[28px] p-6 text-white shadow-[0_30px_60px_-30px_rgba(7,29,41,0.9)] sm:p-7">
        <div className="ok-dots pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200">
              <span className="ok-ping relative h-2 w-2 rounded-full bg-emerald-300" /> Run today&apos;s queue
            </p>
            <h1 className="mt-2 text-[28px] font-extrabold tracking-tight">{clinic.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="relative">
                <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-200" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 rounded-xl border border-white/15 bg-white/10 pl-9 pr-3 text-sm font-semibold text-white outline-none backdrop-blur [color-scheme:dark] focus:border-teal-300 focus:ring-4 focus:ring-teal-300/20"
                  aria-label="Date"
                />
              </span>
              {date !== todayIST() && (
                <button className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-navy-900 transition hover:-translate-y-0.5" onClick={() => setDate(todayIST())}>
                  Back to today
                </button>
              )}
              <span className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-semibold text-teal-50/80">
                {doctors.length} doctor{doctors.length === 1 ? '' : 's'} · {doctors.filter((d) => d.snapshot.status === 'ONLINE').length} online now
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3 text-right backdrop-blur">
            <div className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums">{clock}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200/70">India time</div>
          </div>
        </div>
      </div>

      {!doctors.length ? (
        <Empty
          text={clinic.approvedDoctors ? 'No doctor sits here on this date.' : 'Your queue console opens as soon as your first doctor is added. Patients can only book a doctor, so this is the step that turns your listing into a working queue.'}
          action={clinic.myRole === 'CLINIC_OWNER' && !clinic.approvedDoctors ? <a href={`/console/${id}/doctors`}><Button>Add your first doctor</Button></a> : undefined}
        />
      ) : (
        <>
          {/* Doctor cards (CLN-09) */}
          <div className="-mx-1 mb-6 flex gap-3 overflow-x-auto px-1 pb-2">
            {doctors.map((d) => {
              const snap = d.snapshot;
              const mins = minutesUntil(snap.date, snap.startTime);
              const isSel = d === sel;
              const status =
                snap.status === 'ONLINE' ? 'Online' : snap.status === 'PAUSED' ? 'On break' : snap.status === 'ENDED' ? 'Sitting over' : snap.status === 'CANCELLED' ? 'Cancelled' : mins > 0 ? `Starts in ${fmtIn(mins)}` : 'Offline';
              return (
                <button
                  key={snap.instanceId}
                  onClick={() => setSelId(snap.instanceId)}
                  className={cx(
                    'relative min-w-[250px] overflow-hidden rounded-[22px] border bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5',
                    isSel ? 'border-teal-400 shadow-[0_18px_40px_-20px_rgba(13,148,136,0.6)] ring-4 ring-teal-500/10' : 'border-slate-200/70 shadow-[0_10px_28px_-20px_rgba(15,23,42,0.3)] hover:border-slate-300',
                  )}
                >
                  {isSel && <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 to-emerald-500" />}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="relative">
                        <Avatar name={d.doctor.name} size={40} />
                        <span className={cx('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white', snap.status === 'ONLINE' ? 'bg-emerald-500' : snap.status === 'PAUSED' ? 'bg-amber-400' : 'bg-slate-300')} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-bold text-navy-900">Dr. {d.doctor.name}</div>
                        <div className="truncate text-xs text-slate-500">{d.specialties.join(', ')}</div>
                      </div>
                    </div>
                    <span onClick={(e) => e.stopPropagation()}>
                      <Toggle
                        checked={snap.status === 'ONLINE'}
                        disabled={['ENDED', 'CANCELLED'].includes(snap.status)}
                        label="Doctor online"
                        onChange={(v) => api(`/clinic/${id}/instances/${snap.instanceId}/action`, { body: { action: v ? 'ONLINE' : 'OFFLINE' } }).then(() => qc.invalidateQueries({ queryKey: key }))}
                      />
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Icon name="clock" className="h-3.5 w-3.5" />
                      {t12(snap.startTime)} – {t12(snap.endTime)}
                    </span>
                    <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', snap.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-700' : snap.status === 'ENDED' || snap.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700')}>
                      {status}
                      {snap.delayMinutes > 0 && snap.status !== 'ENDED' ? ` · ${snap.delayMinutes} min late` : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {sel && s && (
            <>
              <div className="mb-5 grid gap-5 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">Selected sitting</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-tight text-navy-900">Dr. {sel.doctor.name}</h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      {t12(s.startTime)} – {t12(s.endTime)} <StatusBadge status={s.status} /> {!s.bookingsOpen && <Badge tone="warn">online bookings stopped</Badge>}
                    </p>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 p-4 text-white">
                      <div className="ok-dots pointer-events-none absolute inset-0" />
                      <div className="relative text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200/80">Now serving</div>
                      <div className="relative mt-1 text-[40px] font-black leading-none tabular-nums">#{s.nowServing ?? '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-4 ring-1 ring-amber-100">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700/80">Waiting</div>
                      <div className="mt-1 text-[40px] font-black leading-none tabular-nums text-navy-900">{s.waiting}</div>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-emerald-100">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700/80">Completed</div>
                      <div className="mt-1 text-[40px] font-black leading-none tabular-nums text-navy-900">{s.completed}</div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {s.status === 'SCHEDULED' && (
                      <Button className="flex-1 py-3.5 text-[15px]" loading={act.isPending} onClick={() => act.mutate({ action: 'ONLINE' })}>
                        <Icon name="bolt" className="h-[18px] w-[18px]" /> Put Dr. {sel.doctor.name} online
                      </Button>
                    )}
                    {s.status === 'ONLINE' && (
                      <Button className="flex-1 py-3.5 text-base" loading={act.isPending} onClick={() => act.mutate({ action: 'CALL_NEXT' })}>
                        Call next <Icon name="arrow" className="h-5 w-5" />
                      </Button>
                    )}
                    {s.status === 'PAUSED' && (
                      <Button className="flex-1 py-3.5 text-[15px]" onClick={() => act.mutate({ action: 'RESUME' })}>
                        Resume queue
                      </Button>
                    )}
                  </div>
                  {s.status === 'SCHEDULED' && <p className="mt-2 text-xs text-slate-500">Go online when the doctor reaches the chamber. Patients can&apos;t join the queue before that.</p>}
                </Card>
                <Card title="Walk-in" subtitle="Gives the next token to a patient at the desk" icon="user">
                  {clinic.entitlements.features.WALK_IN ? (
                    <div className="space-y-3">
                      <Input placeholder="Patient name" value={walk.name} onChange={(e) => setWalk({ ...walk, name: e.target.value })} disabled={!!closed} />
                      <Input placeholder="Phone (optional — sends token by SMS)" value={walk.phone} onChange={(e) => setWalk({ ...walk, phone: e.target.value })} disabled={!!closed} />
                      <Button className="w-full" disabled={!walk.name || !!closed} loading={addWalk.isPending} onClick={() => addWalk.mutate(undefined, { onSuccess: () => setWalk({ name: '', phone: '' }) })}>
                        + Add walk-in
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-700">Walk-in entry is not enabled for your clinic. Contact Okidoc to enable it.</p>
                  )}
                </Card>
              </div>

              {/* Advanced controls */}
              <Card className="mb-5 !py-4">
                <button className="flex w-full items-center justify-between gap-3 text-sm font-bold text-navy-900" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Icon name="sliders" className="h-[18px] w-[18px]" />
                    </span>
                    Advanced controls
                    <span className="hidden text-xs font-medium text-slate-400 sm:inline">Break, delay, stop bookings, end or cancel</span>
                  </span>
                  <Icon name="chevronDown" className={cx('h-5 w-5 text-slate-400 transition', advanced && 'rotate-180')} />
                </button>
                {advanced && (
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    {s.status === 'ONLINE' && <Button tone="outline" onClick={() => act.mutate({ action: 'PAUSE' })}>Pause (break)</Button>}
                    {s.status !== 'SCHEDULED' && !closed && <Button tone="outline" onClick={() => act.mutate({ action: 'OFFLINE' })}>Go offline</Button>}
                    <Field label="Delay (min)">
                      <Input type="number" min={0} value={delay} onChange={(e) => setDelay(e.target.value)} className="!w-24" />
                    </Field>
                    <Button tone="outline" disabled={!!closed} onClick={() => act.mutate({ action: 'DELAY', delayMinutes: Number(delay) || 0 })}>Notify delay</Button>
                    <Button tone="outline" onClick={() => act.mutate({ action: s.bookingsOpen ? 'STOP_BOOKINGS' : 'OPEN_BOOKINGS' })}>{s.bookingsOpen ? 'Stop online bookings' : 'Open online bookings'}</Button>
                    {!closed && <Button tone="dark" onClick={() => setEndOpen(true)}>End sitting</Button>}
                    {!closed && <Button tone="danger" onClick={() => setCancelOpen(true)}>Cancel sitting</Button>}
                  </div>
                )}
              </Card>

              {/* Today's bookings tiles (CLN-14) */}
              <Card title="Today's bookings" subtitle="Tap a box to see these patients — call or WhatsApp them" icon="ticket" className="mb-5">
                <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                  {tiles.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTile(t.id)}
                      className={cx('group rounded-2xl bg-gradient-to-b p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(15,23,42,0.35)]', t.tone)}
                    >
                      <div className="text-[28px] font-extrabold leading-none tabular-nums text-navy-900">{t.rows.length}</div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <span className={cx('h-2 w-2 rounded-full', t.dot)} />
                        {t.label}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <MissedTurn
                rows={sel.bookings.filter((b: any) => b.status === 'LATE' || b.status === 'SKIPPED')}
                rejoinAfter={sel.clinic.lateRejoinAfter ?? 2}
                clinicId={id}
                closed={!!closed}
                onAction={(bookingId, action) => bAct.mutate({ bookingId, action })}
              />

              <Card title="Queue" subtitle="Token order for the selected sitting" icon="users">
                <QueueTable rows={sel.bookings} onAction={(bookingId, action, paidVia, reason) => bAct.mutate({ bookingId, action, paidVia, reason })} sittingOnline={s.status === 'ONLINE'} />
              </Card>

              <Modal open={!!tile} onClose={() => setTile(null)} title={`${TILE.find((t) => t.id === tile)?.label ?? ''} patients`} wide>
                <Table
                  rows={tiles.find((t) => t.id === tile)?.rows ?? []}
                  cols={[
                    { h: 'Token', c: (b: any) => `#${b.tokenNo}` },
                    { h: 'Patient', c: (b: any) => b.patientName },
                    { h: 'Status', c: (b: any) => <StatusBadge status={b.status} /> },
                    {
                      h: 'Contact',
                      c: (b: any) =>
                        b.phone ? (
                          <div className="flex gap-2">
                            <a className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100 hover:bg-teal-100" href={`tel:+91${b.phone}`}><Icon name="phone" className="h-3.5 w-3.5" />Call</a>
                            <a className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100" target="_blank" rel="noreferrer" href={`https://wa.me/91${b.phone}?text=${encodeURIComponent(`Okidoc: Token #${b.tokenNo} with Dr. ${sel.doctor.name} at ${clinic.name}.`)}`}>WhatsApp</a>
                          </div>
                        ) : (
                          '—'
                        ),
                    },
                  ]}
                />
              </Modal>
              <Modal open={endOpen} onClose={() => setEndOpen(false)} title="End this sitting">
                {(() => {
                  const late = sel.bookings.filter((b: any) => b.status === 'LATE').length;
                  const notCome = sel.bookings.filter((b: any) => b.status === 'BOOKED').length;
                  const unseen = sel.bookings.filter((b: any) => b.status === 'PRESENT' || b.status === 'SKIPPED').length;
                  return (
                    <div className="space-y-3 text-sm text-slate-600">
                      <p>The patient being seen is marked done.</p>
                      {late > 0 && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-teal-600" checked={moveLate} onChange={(e) => setMoveLate(e.target.checked)} />
                          <span>
                            <span className="block font-bold text-navy-900">Move {late} patient{late > 1 ? 's' : ''} who missed their turn to Dr. {sel.doctor.name}&apos;s next sitting</span>
                            <span className="text-slate-600">They get a new token and an SMS. Otherwise they are marked as absent.</span>
                          </span>
                        </label>
                      )}
                      {notCome > 0 && <p>{notCome} booked patient{notCome > 1 ? 's' : ''} who never came will be marked as absent.</p>}
                      {unseen > 0 && <p>{unseen} patient{unseen > 1 ? 's' : ''} waiting here but not seen will be cancelled with a full refund.</p>}
                    </div>
                  );
                })()}
                <div className="mt-5 flex justify-end gap-2">
                  <Button tone="outline" onClick={() => setEndOpen(false)}>Keep running</Button>
                  <Button tone="dark" loading={act.isPending} onClick={() => act.mutate({ action: 'END', moveLate }, { onSuccess: () => setEndOpen(false) })}>
                    End sitting
                  </Button>
                </div>
              </Modal>
              <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this sitting">
                <p className="mb-3 text-sm text-slate-600">All booked patients are notified, and online payments are refunded in full.</p>
                <Field label="Reason (sent to patients)">
                  <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                </Field>
                <div className="mt-4 flex justify-end">
                  <Button tone="danger" disabled={cancelReason.length < 3} onClick={() => act.mutate({ action: 'CANCEL', reason: cancelReason }, { onSuccess: () => setCancelOpen(false) })}>
                    Cancel sitting
                  </Button>
                </div>
              </Modal>
            </>
          )}
        </>
      )}
    </>
  );
}

/** Clinics can cancel any waiting booking, also after the sitting has started; the reason goes to the patient. */
function askCancel(b: any): string | null {
  const r = prompt(`Cancel token #${b.tokenNo} (${b.patientName})?\nReason sent to the patient — online payment is refunded in full:`, 'Patient asked to cancel');
  return r === null ? null : r.trim() || 'Cancelled by the clinic';
}

function QueueTable({ rows, onAction, sittingOnline }: { rows: any[]; onAction: (id: string, action: string, paidVia?: string, reason?: string) => void; sittingOnline: boolean }) {
  const btn = (b: any, action: string, label: string, tone: 'outline' | 'primary' | 'ghost' = 'outline') => (
    <Button key={action} tone={tone} className="!rounded-lg !px-3 !py-1.5 text-xs" onClick={() => onAction(b.id, action)}>
      {label}
    </Button>
  );
  return (
    <Table
      rows={rows.filter((b) => b.status !== 'PENDING_PAYMENT')}
      empty="No bookings yet for this sitting."
      cols={[
        {
          h: 'Token',
          c: (b: any) => (
            <span className={cx('inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-base font-extrabold tabular-nums', b.status === 'IN_CONSULTATION' ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-[0_6px_16px_-6px_rgba(13,148,136,0.8)]' : 'bg-slate-100 text-navy-900')}>
              #{b.tokenNo}
            </span>
          ),
        },
        {
          h: 'Patient',
          c: (b: any) => (
            <div>
              <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                {b.patientName}
                {b.checkInAt && ['LATE', 'BOOKED'].includes(b.status) && <Badge tone="info">says they&apos;re here</Badge>}
                {b.status === 'PRESENT' && b.recalledAt && <Badge tone="warn">{b.rejoinAfter ? `came back · after ${b.rejoinAfter}` : 'recalled · next'}</Badge>}
              </div>
              <div className="text-xs text-slate-500">
                {b.source === 'ONLINE' ? 'Online' : b.source === 'OFFLINE' ? 'Walk-in (offline sync)' : 'Walk-in'}
                {b.phone ? ` · ${b.phone}` : ''}
                {b.movedFrom ? ` · moved from ${sittingLabel(b.movedFrom)}` : ''}
              </div>
            </div>
          ),
        },
        { h: 'Status', c: (b: any) => <StatusBadge status={b.status} /> },
        { h: 'Payment', c: (b: any) => (b.paymentMode === 'ONLINE_FULL' ? <Badge tone="ok">paid online</Badge> : b.paidAtClinic ? <Badge tone="ok">paid</Badge> : <span className="text-xs text-slate-500">at clinic</span>) },
        {
          h: 'Actions',
          c: (b: any) => (
            <div className="flex flex-wrap gap-1">
              {b.status === 'BOOKED' && [btn(b, 'PRESENT', 'Present', 'primary'), btn(b, 'LATE', 'Late'), btn(b, 'NO_SHOW', 'Absent', 'ghost')]}
              {b.status === 'PRESENT' && [sittingOnline && btn(b, 'CALL', 'Call in', 'primary'), btn(b, 'SKIP', 'Hold')]}
              {b.status === 'LATE' && [btn(b, 'PRESENT', 'Arrived', 'primary'), btn(b, 'RECALL', 'Recall now'), btn(b, 'NO_SHOW', 'Absent', 'ghost')]}
              {b.status === 'SKIPPED' && btn(b, 'RECALL', 'Recall', 'primary')}
              {b.status === 'IN_CONSULTATION' && [btn(b, 'COMPLETE', 'Done', 'primary'), btn(b, 'SKIP', 'Hold')]}
              {b.status === 'NO_SHOW' && btn(b, 'UNDO_NO_SHOW', 'Came after all — undo absent')}
              {['SERVED', 'IN_CONSULTATION', 'PRESENT'].includes(b.status) && b.paymentMode !== 'ONLINE_FULL' && !b.paidAtClinic && (
                <>
                  <Button tone="ghost" className="!rounded-lg !px-3 !py-1.5 text-xs" onClick={() => onAction(b.id, 'PAID_AT_CLINIC', 'CASH')}>Paid cash</Button>
                  <Button tone="ghost" className="!rounded-lg !px-3 !py-1.5 text-xs" onClick={() => onAction(b.id, 'PAID_AT_CLINIC', 'UPI')}>Paid UPI</Button>
                </>
              )}
              {['BOOKED', 'PRESENT', 'LATE', 'SKIPPED'].includes(b.status) && (
                <Button tone="ghost" className="!rounded-lg !px-3 !py-1.5 text-xs text-red-600" onClick={() => {
                    const reason = askCancel(b);
                    if (reason !== null) onAction(b.id, 'CANCEL', undefined, reason);
                  }}>
                  Cancel
                </Button>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}

/** BR-06a: patients whose token came up while they were away, with the ways to bring them back. */
function MissedTurn({ rows, rejoinAfter, clinicId, closed, onAction }: { rows: any[]; rejoinAfter: number; clinicId: string; closed: boolean; onAction: (id: string, action: string) => void }) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => (b.checkInAt ? 1 : 0) - (a.checkInAt ? 1 : 0) || a.tokenNo - b.tokenNo);
  return (
    <Card
      className="mb-5 !border-amber-200/80 bg-gradient-to-b from-amber-50/60 to-white"
      icon="clock"
      title={`Missed their turn (${rows.length})`}
      subtitle={
        <>
          When a late patient arrives, tap <b>Arrived</b> — they rejoin after {rejoinAfter === 0 ? 'the current patient' : `${rejoinAfter} more patient${rejoinAfter > 1 ? 's' : ''}`}.{' '}
          <a className="font-semibold text-teal-700 underline-offset-2 hover:underline" href={`/console/${clinicId}/profile#late`}>Change rule</a>
        </>
      }
    >
      <ul className="divide-y divide-amber-100">
        {sorted.map((b) => (
          <li key={b.id} className={cx('flex flex-wrap items-center gap-3 py-3', b.checkInAt && 'rounded-2xl bg-teal-50/70 px-3 ring-1 ring-teal-200')}>
            <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-amber-100 px-2 text-base font-extrabold tabular-nums text-amber-800">#{b.tokenNo}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                {b.patientName}
                {b.checkInAt ? <Badge tone="info">says they&apos;re here · {new Date(b.checkInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })}</Badge> : <StatusBadge status={b.status} />}
              </div>
              <div className="text-xs text-slate-500">
                {b.status === 'SKIPPED' ? 'On hold' : 'Not here when called'}
                {b.phone ? ` · ${b.phone}` : ''}
              </div>
            </div>
            {!closed && (
              <div className="flex flex-wrap gap-1.5">
                {b.status === 'LATE' ? (
                  <Button className="!rounded-lg !px-3 !py-1.5 text-xs" onClick={() => onAction(b.id, 'PRESENT')}>Arrived</Button>
                ) : null}
                <Button tone="outline" className="!rounded-lg !px-3 !py-1.5 text-xs" onClick={() => onAction(b.id, 'RECALL')}>Recall now</Button>
                <Button tone="outline" className="!rounded-lg !px-3 !py-1.5 text-xs" onClick={() => confirm(`Move #${b.tokenNo} ${b.patientName} to the doctor's next sitting? They get a new token.`) && onAction(b.id, 'MOVE_NEXT')}>
                  Next sitting
                </Button>
                {b.phone && (
                  <a className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-slate-200 hover:bg-teal-50" href={`tel:+91${b.phone}`}>
                    <Icon name="phone" className="h-3.5 w-3.5" />
                    Call
                  </a>
                )}
                {b.status === 'LATE' && (
                  <Button tone="ghost" className="!rounded-lg !px-3 !py-1.5 text-xs" onClick={() => onAction(b.id, 'NO_SHOW')}>Absent</Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
