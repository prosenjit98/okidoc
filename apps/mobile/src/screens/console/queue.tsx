import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { addDays, CLINIC_TYPE_LABELS, type ClinicType, type QueueBookingView } from '@okidoc/shared';
import { router } from '@/lib/nav';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { BookingActionSheet, whatsapp } from '@/components/BookingActions';
import { Bell, StatusPill } from '@/components/common';
import { Badge, Button, Callout, Card, Chip, Empty, ErrorView, Input, Loading, Row, Screen, Section, Sheet, statusTone, T } from '@/components/ui';
import { api, errMessage } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { istClock, normalizePhone, startsIn, t12, todayIST } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useRoom } from '@/lib/socket';
import { C } from '@/lib/theme';
import type { StaffView } from '@/lib/types';

type Tile = 'total' | 'online' | 'walkIn' | 'present' | 'late' | 'cancelled';
const TILE_FILTER: Record<Tile, (b: QueueBookingView) => boolean> = {
  total: (b) => b.status !== 'PENDING_PAYMENT',
  online: (b) => b.source === 'ONLINE' && b.status !== 'PENDING_PAYMENT',
  walkIn: (b) => b.source !== 'ONLINE',
  present: (b) => ['PRESENT', 'IN_CONSULTATION', 'SERVED', 'SKIPPED'].includes(b.status),
  late: (b) => b.status === 'LATE',
  cancelled: (b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW',
};

function Clock() {
  const [now, setNow] = useState(istClock());
  useEffect(() => {
    const id = setInterval(() => setNow(istClock()), 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Ionicons name="time-outline" size={18} color={C.white} />
      <Text style={{ color: C.white, fontSize: 11, fontWeight: '700' }}>{now} IST</Text>
    </View>
  );
}

/** CLN-02 / CLN-08..14 queue console (phone + tablet). Live via socket room clinic:<id>. */
export default function ClinicQueue() {
  const t = useT();
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  const { clinicId, clinic, isOwner, has, loading } = useClinic();
  const [date, setDate] = useState(todayIST());
  const q = useApi<{ date: string; doctors: StaffView[] }>(['clinic-queue', clinicId, date], clinicId ? `/clinic/${clinicId}/queue?date=${date}` : null, { refetchInterval: 30_000 });
  const [selId, setSelId] = useState<string | null>(null);
  const [walkName, setWalkName] = useState('');
  const [walkPhone, setWalkPhone] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [tile, setTile] = useState<Tile | null>(null);
  const [booking, setBooking] = useState<QueueBookingView | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  useRoom(clinicId ? `clinic:${clinicId}` : null, ['queue:update', 'bookings:changed', 'roster:changed'], () => q.refetch());

  const doctors = q.data?.doctors ?? [];
  const sel = useMemo(() => doctors.find((d) => d.snapshot.instanceId === selId) ?? doctors.find((d) => d.snapshot.status === 'ONLINE') ?? doctors[0], [doctors, selId]);

  const run = async (path: string, body: object) => {
    setBusy(true);
    try {
      await api(path, { body });
      await q.refetch();
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const act = (action: string, extra: object = {}) => sel && run(`/clinic/${clinicId}/instances/${sel.snapshot.instanceId}/action`, { action, ...extra });
  const bookingAct = async (a: string, paidVia?: string, target?: QueueBookingView) => {
    const b = target ?? booking;
    if (!b) return;
    setBooking(null);
    if (a === 'CANCEL') {
      // Clinics can still cancel after the sitting starts (patients cannot). The reason goes to the patient.
      const reason = await new Promise<string | null>((res) =>
        Alert.alert(`Cancel #${b.tokenNo} ${b.patientName}?`, 'The patient is told why, and any online payment is refunded in full.', [
          { text: 'Keep', style: 'cancel', onPress: () => res(null) },
          { text: 'Doctor unavailable', onPress: () => res('Doctor unavailable') },
          { text: 'Patient asked', onPress: () => res('Patient asked to cancel') },
        ]),
      );
      if (!reason) return;
      await run(`/clinic/${clinicId}/bookings/${b.id}/action`, { action: a, reason });
      return;
    }
    if (a === 'MOVE_NEXT') {
      const ok = await new Promise<boolean>((res) =>
        Alert.alert(`Move #${b.tokenNo} ${b.patientName}?`, "They get a new token at the doctor's next sitting here, and an SMS.", [
          { text: t('common.cancel'), style: 'cancel', onPress: () => res(false) },
          { text: 'Move', onPress: () => res(true) },
        ]),
      );
      if (!ok) return;
    }
    await run(`/clinic/${clinicId}/bookings/${b.id}/action`, { action: a, paidVia });
  };
  const missed = sel ? sel.bookings.filter((b) => b.status === 'LATE' || b.status === 'SKIPPED').sort((x, y) => (y.checkInAt ? 1 : 0) - (x.checkInAt ? 1 : 0) || x.tokenNo - y.tokenNo) : [];
  const rejoinAfter = sel?.clinic.lateRejoinAfter ?? 2;
  const addWalkIn = async () => {
    if (!sel || !walkName.trim()) return;
    await run(`/clinic/${clinicId}/instances/${sel.snapshot.instanceId}/walk-ins`, { name: walkName.trim(), phone: normalizePhone(walkPhone) || undefined });
    setWalkName('');
    setWalkPhone('');
  };

  if (loading) return <Screen title={t('console.title')}><Loading /></Screen>;

  // CLN-02 registered empty state (and, once a request is out, who the clinic is waiting for)
  if (clinic && clinic.approvedDoctors === 0) {
    const pending = clinic.pendingDoctors ?? [];
    return (
      <Screen title={t('console.title')} subtitle={t('console.subtitle')} right={<Clock />}>
        <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Ionicons name="medkit-outline" size={42} color={C.teal} />
          <T variant="h2" style={{ marginTop: 12, textAlign: 'center' }}>
            {t('console.registered', { name: clinic.name })}
          </T>
          <Text style={{ color: C.muted, fontWeight: '700', marginTop: 2 }}>{clinic.code}</Text>
          <T variant="muted" style={{ textAlign: 'center', marginTop: 10 }}>
            {t('console.registeredBody')}
          </T>
          {clinic.verification !== 'APPROVED' && (
            <View style={{ alignSelf: 'center', marginTop: 12 }}>
              <Badge text={`Okidoc verification: ${clinic.verification.toLowerCase()}`} tone="warn" />
            </View>
          )}
          {pending.length ? (
            <>
              <View style={{ marginTop: 18, alignSelf: 'stretch' }}>
                <Callout
                  tone="info"
                  icon="hourglass-outline"
                  title={pending.length === 1 ? t('console.pendingTitle', { name: `Dr. ${pending[0]}` }) : t('console.pendingTitleMany', { count: pending.length })}
                  body={t('console.pendingBody')}
                />
              </View>
              <Button title={t('console.viewRequests')} style={{ marginTop: 14, alignSelf: 'stretch' }} onPress={() => router.push('/console/doctors')} />
              {isOwner && <Button tone="outline" title={t('console.addAnotherDoctor')} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={() => router.push('/k/add-doctor')} />}
            </>
          ) : (
            isOwner && <Button title={t('console.addFirstDoctor')} style={{ marginTop: 18, alignSelf: 'stretch' }} onPress={() => router.push('/k/add-doctor')} />
          )}
        </Card>
      </Screen>
    );
  }

  const s = sel?.snapshot;
  const soon = s ? startsIn(s.date, s.startTime) : null;
  const queueList = sel ? sel.bookings.filter((b) => b.status !== 'PENDING_PAYMENT') : [];

  const left = (
    <>
      <ScrollView horizontal={!tablet} showsHorizontalScrollIndicator={false} contentContainerStyle={tablet ? { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } : undefined}>
        {doctors.map((d) => {
          const on = d.snapshot.status === 'ONLINE';
          const active = d.snapshot.instanceId === sel?.snapshot.instanceId;
          const st = startsIn(d.snapshot.date, d.snapshot.startTime);
          return (
            <Pressable key={d.snapshot.instanceId} onPress={() => setSelId(d.snapshot.instanceId)} style={[docCard, active && { borderColor: C.teal, borderWidth: 2 }, !tablet && { marginRight: 10 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>
                  Dr. {d.doctor.name}
                </T>
                <Switch
                  value={on}
                  disabled={busy || d.snapshot.status === 'ENDED' || d.snapshot.status === 'CANCELLED'}
                  onValueChange={(v) => run(`/clinic/${clinicId}/instances/${d.snapshot.instanceId}/action`, { action: v ? 'ONLINE' : 'OFFLINE' })}
                  trackColor={{ true: C.teal, false: '#CBD5E1' }}
                  thumbColor={C.white}
                />
              </Row>
              <T variant="muted" numberOfLines={1}>
                {t12(d.snapshot.startTime)} – {t12(d.snapshot.endTime)}
              </T>
              <Text style={{ color: on ? C.ok : d.snapshot.status === 'ENDED' ? C.muted : C.warn, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                {on ? 'Online' : d.snapshot.status === 'ENDED' ? 'Sitting over' : d.snapshot.status === 'CANCELLED' ? 'Cancelled' : st ? `Starts in ${st}` : 'Offline'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {s && sel && (
        <>
          <Card style={{ marginTop: 12 }}>
            <T variant="label">Selected doctor's sitting</T>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <T variant="h3">Dr. {sel.doctor.name}</T>
              <StatusPill status={s.presence === 'DELAYED' ? 'DELAYED' : s.status} label={s.presence === 'DELAYED' ? `late ${s.delayMinutes}m` : undefined} />
            </Row>
            <T variant="muted">
              {t12(s.startTime)} – {t12(s.endTime)}
              {soon && s.status === 'SCHEDULED' ? ` · ${t('console.startsIn', { t: soon })}` : ''}
              {!s.bookingsOpen ? ' · online bookings stopped' : ''}
            </T>
            <View style={{ flexDirection: 'row', marginVertical: 14 }}>
              {[
                [t('console.nowServing'), s.nowServing ? `#${s.nowServing}` : '#—'],
                [t('console.waiting'), s.waiting],
                [t('console.completed'), s.completed],
              ].map(([k, v]) => (
                <View key={String(k)} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: C.navy900 }}>{v}</Text>
                  <T variant="muted">{k}</T>
                </View>
              ))}
            </View>
            {s.status === 'ONLINE' ? (
              <Button title="Call next" icon="megaphone-outline" loading={busy} onPress={() => act('CALL_NEXT')} />
            ) : s.status === 'PAUSED' ? (
              <Button title={t('console.resume')} icon="play" loading={busy} onPress={() => act('RESUME')} />
            ) : s.status === 'SCHEDULED' ? (
              <>
                <T variant="muted" style={{ marginBottom: 8 }}>
                  {t('console.onlineHint')}
                </T>
                <Button title={t('console.putOnline', { name: `Dr. ${sel.doctor.name}` })} icon="radio-button-on" loading={busy} onPress={() => act('ONLINE')} />
              </>
            ) : (
              <T variant="muted">This sitting is {s.status.toLowerCase()}.</T>
            )}
          </Card>
          {has('WALK_IN') && s.status !== 'ENDED' && s.status !== 'CANCELLED' && (
            <Card>
              <T variant="label" style={{ marginBottom: 8 }}>
                {t('console.walkinPlaceholder')}
              </T>
              <Row>
                <TextInput value={walkName} onChangeText={setWalkName} placeholder="Name" placeholderTextColor={C.faint} style={walkInput} />
                <TextInput value={walkPhone} onChangeText={setWalkPhone} placeholder="Phone" keyboardType="phone-pad" placeholderTextColor={C.faint} style={[walkInput, { flex: 0.8 }]} />
                <Button small title={t('common.add')} disabled={!walkName.trim() || busy} onPress={addWalkIn} />
              </Row>
            </Card>
          )}
          <Pressable onPress={() => setAdvanced(!advanced)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
            <Ionicons name="options-outline" size={18} color={C.navy900} />
            <T variant="h3" style={{ flex: 1 }}>
              {t('console.advanced')}
            </T>
            <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
          </Pressable>
          {advanced && (
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {s.status === 'ONLINE' && <Button small tone="soft" icon="pause" title={t('console.pause')} onPress={() => act('PAUSE')} />}
                {[10, 15, 30, 60].map((m) => (
                  <Button key={m} small tone="soft" icon="time-outline" title={`${t('console.delay')} ${m}m`} onPress={() => act('DELAY', { delayMinutes: m })} />
                ))}
                {s.delayMinutes > 0 && <Button small tone="soft" title="Clear delay" onPress={() => act('DELAY', { delayMinutes: 0 })} />}
                <Button small tone="soft" icon={s.bookingsOpen ? 'lock-closed-outline' : 'lock-open-outline'} title={s.bookingsOpen ? t('console.stopBookings') : t('console.openBookings')} onPress={() => act(s.bookingsOpen ? 'STOP_BOOKINGS' : 'OPEN_BOOKINGS')} />
                <Button
                  small
                  tone="outline"
                  icon="stop-circle-outline"
                  title={t('console.endSitting')}
                  onPress={() => {
                    const late = sel.bookings.filter((b) => b.status === 'LATE').length;
                    if (!late) {
                      Alert.alert(t('console.endSitting'), 'Booked patients who did not come are marked absent.', [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('console.endSitting'), style: 'destructive', onPress: () => act('END') },
                      ]);
                      return;
                    }
                    Alert.alert(
                      t('console.endSitting'),
                      `${late} patient${late > 1 ? 's' : ''} missed their turn and ${late > 1 ? 'have' : 'has'} not come back. Move them to Dr. ${sel.doctor.name}'s next sitting, or mark them absent?`,
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: 'Mark absent', style: 'destructive', onPress: () => act('END') },
                        { text: 'Move & end', onPress: () => act('END', { moveLate: true }) },
                      ],
                    );
                  }}
                />
                <Button small tone="outline" icon="close-circle-outline" title={t('console.cancelSitting')} onPress={() => setCancelOpen(true)} />
              </View>
            </Card>
          )}
          <Section title={t('console.todaysBookings')}>
            <T variant="muted" style={{ marginBottom: 8 }}>
              {t('console.tilesHint')}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(
                [
                  ['total', t('console.total'), C.white],
                  ['online', t('console.online'), C.white],
                  ['walkIn', t('console.walkin'), C.white],
                  ['present', t('console.present'), C.okSoft],
                  ['late', t('console.late'), C.warnSoft],
                  ['cancelled', t('console.cancelled'), C.badSoft],
                ] as [Tile, string, string][]
              ).map(([k, label, bg]) => (
                <Pressable key={k} onPress={() => setTile(k)} style={[tileBox, { backgroundColor: bg }]}>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: C.navy900 }}>{sel.tiles[k]}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted }}>{label.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        </>
      )}
    </>
  );

  const right = sel ? (
    <>
    {missed.length > 0 && (
      <Section title={`Missed their turn · ${missed.length}`}>
        <T variant="muted" style={{ marginBottom: 8 }}>
          When a late patient arrives, tap Arrived — they rejoin {rejoinAfter === 0 ? 'right after the current patient' : `after ${rejoinAfter} more patient${rejoinAfter > 1 ? 's' : ''}`}.
        </T>
        {missed.map((b) => (
          <Pressable key={b.id} onPress={() => setBooking(b)} style={[queueRow, { backgroundColor: b.checkInAt ? C.tealSoft : C.warnSoft, borderColor: b.checkInAt ? C.teal : 'transparent' }]}>
            <Text style={{ width: 52, fontSize: 20, fontWeight: '900', color: C.navy900 }}>#{b.tokenNo}</Text>
            <View style={{ flex: 1 }}>
              <T variant="h3" numberOfLines={1}>
                {b.patientName}
              </T>
              <T variant="muted" numberOfLines={1}>
                {b.checkInAt ? 'Says they are here' : b.status === 'SKIPPED' ? 'On hold' : 'Not here when called'}
              </T>
            </View>
            {b.status === 'LATE' ? (
              <Button small title="Arrived" disabled={busy} onPress={() => bookingAct('PRESENT', undefined, b)} />
            ) : (
              <Button small tone="soft" title="Recall" disabled={busy} onPress={() => bookingAct('RECALL', undefined, b)} />
            )}
          </Pressable>
        ))}
      </Section>
    )}
    <Section title={`Queue · ${queueList.length}`}>
      {queueList.length ? (
        queueList.map((b) => (
          <Pressable key={b.id} onPress={() => setBooking(b)} style={[queueRow, b.status === 'IN_CONSULTATION' && { borderColor: C.teal, borderWidth: 2 }]}>
            <Text style={{ width: 52, fontSize: 20, fontWeight: '900', color: C.navy900 }}>#{b.tokenNo}</Text>
            <View style={{ flex: 1 }}>
              <T variant="h3" numberOfLines={1}>
                {b.patientName}
              </T>
              <T variant="muted">
                {b.source === 'ONLINE' ? 'Online' : b.source === 'OFFLINE' ? 'Offline walk-in' : 'Walk-in'}
                {b.paymentMode === 'ONLINE_FULL' ? ' · prepaid' : b.paidAtClinic ? ' · paid' : ''}
                {b.status === 'PRESENT' && b.recalledAt ? ' · came back' : ''}
                {b.movedFrom ? ' · moved' : ''}
              </T>
            </View>
            <Badge text={t(`status.${b.status}` as never)} tone={statusTone(b.status)} />
          </Pressable>
        ))
      ) : (
        <T variant="muted">No patients yet.</T>
      )}
    </Section>
    </>
  ) : null;

  return (
    <Screen
      title={clinic?.name ?? t('console.title')}
      subtitle={`${CLINIC_TYPE_LABELS[clinic?.type as ClinicType] ?? 'Clinic'} · ${t('console.subtitle')}`}
      onRefresh={q.refetch}
      refreshing={q.isRefetching}
      right={
        <Row>
          <Clock />
          <Bell />
          {clinic?.myRole === 'QUEUE_MANAGER' && (
            <Pressable onPress={() => router.push('/k/account')} accessibilityLabel="Account" style={{ padding: 4 }}>
              <Ionicons name="person-circle-outline" size={30} color={C.white} />
            </Pressable>
          )}
        </Row>
      }
      headerExtra={
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {[0, 1].map((n) => {
            const d = addDays(todayIST(), n);
            return <Chip key={n} label={n === 0 ? t('common.today') : t('common.tomorrow')} active={date === d} onPress={() => setDate(d)} />;
          })}
        </View>
      }
    >
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={q.refetch} />
      ) : !doctors.length ? (
        <Empty icon="calendar-clear-outline" title="No sittings on this day" body="Add weekly sittings for your doctors in the Doctors tab." action={isOwner ? t('tab.doctors') : undefined} onAction={() => router.push('/console/doctors')} />
      ) : tablet ? (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1.2 }}>{left}</View>
          <View style={{ flex: 1 }}>{right}</View>
        </View>
      ) : (
        <>
          {left}
          {right}
        </>
      )}
      <BookingActionSheet booking={booking} onClose={() => setBooking(null)} onAction={bookingAct} clinicName={clinic?.name ?? ''} rejoinAfter={sel?.clinic.lateRejoinAfter ?? 2} />
      <Sheet visible={!!tile} onClose={() => setTile(null)} title={tile ? `${tile === 'walkIn' ? 'Walk-in' : tile[0].toUpperCase() + tile.slice(1)} · ${sel?.bookings.filter(TILE_FILTER[tile]).length ?? 0}` : ''}>
        {tile &&
          sel?.bookings.filter(TILE_FILTER[tile]).map((b) => (
            <Card key={b.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="h3">
                  #{b.tokenNo} {b.patientName}
                </T>
                <Badge text={t(`status.${b.status}` as never)} tone={statusTone(b.status)} />
              </Row>
              {!!b.phone && (
                <Row style={{ marginTop: 8 }}>
                  <Button small tone="soft" icon="call-outline" title="Call" onPress={() => Linking.openURL(`tel:+91${b.phone}`)} />
                  <Button small tone="soft" icon="logo-whatsapp" title="WhatsApp" onPress={() => whatsapp(b.phone!, `Hello ${b.patientName}, this is ${clinic?.name}. Your token is #${b.tokenNo}.`)} />
                </Row>
              )}
            </Card>
          ))}
      </Sheet>
      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} title={t('console.cancelSitting')}>
        <T variant="muted" style={{ marginBottom: 8 }}>
          All booked patients are notified and online payments refunded in full.
        </T>
        <Input label="Reason" value={reason} onChangeText={setReason} />
        <Button
          title={t('console.cancelSitting')}
          tone="danger"
          disabled={reason.trim().length < 3}
          onPress={() => {
            setCancelOpen(false);
            act('CANCEL', { reason });
            setReason('');
          }}
        />
      </Sheet>
    </Screen>
  );
}

const docCard = { width: 220, backgroundColor: C.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border };
const tileBox = { width: '31.5%' as const, borderRadius: 14, paddingVertical: 14, alignItems: 'center' as const, borderWidth: 1, borderColor: C.border };
const queueRow = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border };
const walkInput = { flex: 1, backgroundColor: C.mint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border };
