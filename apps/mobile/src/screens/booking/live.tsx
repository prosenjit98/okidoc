import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import type { PatientLiveView } from '@okidoc/shared';
import { router, useLocalSearchParams } from '@/lib/nav';
import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { PaySheet, type GatewayPayment } from '@/components/PaySheet';
import { StarPicker, Stars } from '@/components/rating';
import { Badge, Button, Callout, Card, ErrorView, Input, KV, Loading, Row, Screen, Sheet, statusTone, T } from '@/components/ui';
import { api, errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateShort, dayLabel, inr, t12, timeOf } from '@/lib/format';
import { confirm, useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useRoom } from '@/lib/socket';
import { C } from '@/lib/theme';

export interface BookingView {
  id: string;
  tokenNo: number;
  status: string;
  patientName: string;
  paymentMode: string;
  consultationFee: number;
  payableNow: number;
  paidOnline: number;
  holdExpiresAt?: string | null;
  cancelReason?: string | null;
  cancelledBy?: string | null;
  reviewed: boolean;
  review?: { rating: number | null; clinicRating: number | null; comment: string | null } | null;
  payments: { id: string; status: string; amountPaise: number; refundedPaise: number; gatewayOrderId: string; gateway: string }[];
  instance: { id: string; date: string; startTime: string; endTime: string; status: string; presence: string; delayMinutes: number; nowServing: number | null };
  clinic: { id: string; name: string; addressLine: string; phone?: string | null; lat?: number | null; lng?: number | null; area: { name: string } };
  doctor: { id: string; name: string; degrees?: string | null; specialties: { name: string }[] };
  live?: PatientLiveView;
}

/** PAT-11 live queue for one booking — realtime via socket room instance:<id>. Ad-free (MON-02). */
export default function BookingLive() {
  const t = useT();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const b = useApi<BookingView>(['booking', id], `/bookings/${id}`, { refetchInterval: 30_000 });
  const live = useApi<PatientLiveView>(['live', id], `/bookings/${id}/live`, { refetchInterval: 20_000 });
  const [pay, setPay] = useState<GatewayPayment | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [clinicRating, setClinicRating] = useState(0);
  const [comment, setComment] = useState('');

  useRoom(b.data ? `instance:${b.data.instance.id}` : null, ['queue:update'], () => {
    live.refetch();
    b.refetch();
  });

  const cancel = useAction(() => api<{ refundedPaise: number }>(`/bookings/${id}/cancel`, { body: {} }), {
    invalidate: [['booking', id], ['bookings']],
    onSuccess: (r) => Alert.alert(t('bookings.cancel'), r.refundedPaise > 0 ? `Cancelled. ${inr(r.refundedPaise)} will be refunded.` : 'Booking cancelled.'),
  });
  // PAT-16: one review per visit, rating the doctor, the clinic, or both.
  const review = useAction(
    () => api(`/bookings/${id}/review`, { body: { rating: rating || undefined, clinicRating: clinicRating || undefined, comment: comment.trim() } }),
    {
      invalidate: [['booking', id], ['bookings']],
      onSuccess: () => {
        setRateOpen(false);
        Alert.alert('Okidoc', t('rate.thanks'));
      },
    },
  );
  // BR-06a: missed turn — tell reception "I'm here", or move to the doctor's next sitting (once).
  const checkIn = useAction(() => api<PatientLiveView>(`/bookings/${id}/check-in`, { body: {} }), { invalidate: [['live', id]] });
  const [moving, setMoving] = useState(false);
  const moveNext = async () => {
    setMoving(true);
    try {
      const { next } = await api<{ next: { date: string; startTime: string } | null }>(`/bookings/${id}/next-sitting`);
      if (!next) {
        Alert.alert(t('late.title'), t('late.moveNone'));
        return;
      }
      const when = `${dayLabel(next.date, t)} · ${t12(next.startTime)}`;
      if (!(await confirm(t('late.move'), t('late.moveConfirm', { when }), t('common.continue')))) return;
      const r = await api<{ tokenNo: number; date: string; startTime: string }>(`/bookings/${id}/move-next`, { body: {} });
      await Promise.all([b.refetch(), live.refetch()]);
      Alert.alert('Okidoc', t('late.moved', { when: `${dayLabel(r.date, t)} · ${t12(r.startTime)}`, token: r.tokenNo }));
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    } finally {
      setMoving(false);
    }
  };
  const fromLabel = (from: string) => {
    const [d, hm] = from.split(' ');
    return `${dateShort(d)} · ${t12(hm)}`;
  };

  const openRate = () => {
    setRating(b.data?.review?.rating ?? 0);
    setClinicRating(b.data?.review?.clinicRating ?? 0);
    setComment(b.data?.review?.comment ?? '');
    setRateOpen(true);
  };

  if (b.isLoading) return <Screen back tabs={false} title={t('live.title')}><Loading /></Screen>;
  if (b.error || !b.data) return <Screen back tabs={false} title={t('live.title')}><ErrorView error={b.error} onRetry={b.refetch} /></Screen>;
  const bk = b.data;
  const l = live.data;
  const active = ['BOOKED', 'PRESENT', 'LATE', 'SKIPPED', 'IN_CONSULTATION', 'PENDING_PAYMENT'].includes(bk.status);
  const presence =
    bk.instance.status === 'ENDED'
      ? t('live.ended')
      : bk.instance.status === 'CANCELLED'
        ? t('live.cancelled')
        : bk.instance.presence === 'ONLINE'
          ? t('live.doctorOnline')
          : bk.instance.presence === 'ON_BREAK'
            ? t('live.doctorBreak')
            : bk.instance.presence === 'DELAYED'
              ? t('live.doctorDelayed', { m: bk.instance.delayMinutes })
              : t('live.doctorNotArrived');
  const pendingPayment = bk.payments.find((p) => p.status === 'CREATED');

  return (
    <Screen back tabs={false} title={t('live.title')} subtitle={`Dr. ${bk.doctor.name} · ${bk.clinic.name}`} onRefresh={() => { b.refetch(); live.refetch(); }} refreshing={b.isRefetching}>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Badge text={t(`status.${bk.status}` as never)} tone={statusTone(bk.status)} />
        <T variant="label" style={{ marginTop: 12 }}>
          {t('live.yourToken')}
        </T>
        <Text style={{ fontSize: 64, fontWeight: '900', color: C.navy900 }}>#{bk.tokenNo}</Text>
        <T variant="muted">
          {bk.patientName} · {dayLabel(bk.instance.date, t)} · {t12(bk.instance.startTime)} – {t12(bk.instance.endTime)}
        </T>
      </Card>
      {bk.status === 'LATE' && (
        <Card style={{ backgroundColor: '#FFF8E6', borderColor: '#FDE7B0', borderWidth: 1 }}>
          <Row style={{ alignItems: 'center' }}>
            <Ionicons name="alarm-outline" size={22} color={C.warn} />
            <T variant="h3" style={{ flex: 1, color: '#92400E' }}>
              {t('late.title')}
            </T>
          </Row>
          <T style={{ marginTop: 8 }}>{t('late.body', { token: bk.tokenNo, clinic: bk.clinic.name })}</T>
          {!!l && (
            <T variant="small" style={{ marginTop: 6, color: '#92400E', fontWeight: '700' }}>
              {l.lateRejoinAfter === 0 ? t('late.ruleNext') : t('late.rule', { n: l.lateRejoinAfter })}
            </T>
          )}
          {l?.checkInAt ? (
            <Row style={{ marginTop: 12, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={20} color={C.ok} />
              <T style={{ flex: 1, fontWeight: '700', color: C.navy900 }}>{t('late.checkedIn')}</T>
            </Row>
          ) : (
            <Button title={t('late.imHere')} icon="location-outline" style={{ marginTop: 12 }} loading={checkIn.isPending} onPress={() => checkIn.mutate()} />
          )}
          {l?.canMove && <Button title={t('late.move')} tone="outline" icon="calendar-outline" style={{ marginTop: 8 }} loading={moving} onPress={moveNext} />}
        </Card>
      )}
      {bk.status === 'PRESENT' && l?.rejoined && <Callout tone="info" icon="refresh-circle-outline" title={t('late.rejoined')} />}
      {!!l?.movedFrom && bk.status === 'BOOKED' && <T variant="muted">{t('late.movedFrom', { from: fromLabel(l.movedFrom) })}</T>}
      {active && bk.status !== 'PENDING_PAYMENT' && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <T variant="label">{t('live.nowServing')}</T>
            <Text style={{ fontSize: 34, fontWeight: '900', color: C.tealDark }}>{l?.nowServing ? `#${l.nowServing}` : '—'}</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <T variant="label">{t('live.ahead')}</T>
            <Text style={{ fontSize: 34, fontWeight: '900', color: C.navy900 }}>{bk.status === 'LATE' ? '—' : (l?.patientsAhead ?? '—')}</Text>
          </Card>
        </View>
      )}
      <Card>
        <Row>
          <Ionicons name={bk.instance.presence === 'ONLINE' ? 'radio-button-on' : 'time-outline'} size={18} color={bk.instance.presence === 'ONLINE' ? C.ok : C.warn} />
          <T variant="h3">{presence}</T>
        </Row>
        {active && l?.etaFrom && l.etaTo && (
          <T style={{ marginTop: 8 }}>
            {t('live.eta')}: <Text style={{ fontWeight: '800' }}>{timeOf(l.etaFrom)} – {timeOf(l.etaTo)}</Text>
          </T>
        )}
        {!!l && <T variant="muted" style={{ marginTop: 6 }}>{t('live.updated', { t: timeOf(l.updatedAt) })}</T>}
      </Card>
      {bk.status === 'PENDING_PAYMENT' && pendingPayment && (
        <Card style={{ backgroundColor: C.warnSoft }}>
          <T>Complete payment of {inr(pendingPayment.amountPaise)} to confirm your token.</T>
          <Button
            title={t('book.payNow')}
            style={{ marginTop: 10 }}
            onPress={() => setPay({ paymentId: pendingPayment.id, gateway: pendingPayment.gateway as 'MOCK' | 'RAZORPAY', orderId: pendingPayment.gatewayOrderId, amountPaise: pendingPayment.amountPaise, isMock: pendingPayment.gateway === 'MOCK' })}
          />
        </Card>
      )}
      <Card>
        <T variant="h3">{bk.clinic.name}</T>
        <T variant="muted">
          {bk.clinic.addressLine}, {bk.clinic.area.name}
        </T>
        <Row style={{ marginTop: 10 }}>
          {!!bk.clinic.phone && <Button small tone="soft" icon="call-outline" title="Call" onPress={() => Linking.openURL(`tel:+91${bk.clinic.phone}`)} />}
          <Button
            small
            tone="soft"
            icon="navigate-outline"
            title="Directions"
            onPress={() => Linking.openURL(bk.clinic.lat && bk.clinic.lng ? `https://www.google.com/maps/dir/?api=1&destination=${bk.clinic.lat},${bk.clinic.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bk.clinic.name + ' ' + bk.clinic.addressLine)}`)}
          />
        </Row>
        <View style={{ marginTop: 10 }}>
          <KV k={t('book.fee')} v={inr(bk.consultationFee)} />
          {bk.paidOnline > 0 && <KV k="Paid online" v={inr(bk.paidOnline)} />}
          {bk.payments.some((p) => p.refundedPaise > 0) && <KV k="Refunded" v={inr(bk.payments.reduce((a, p) => a + p.refundedPaise, 0))} />}
        </View>
      </Card>
      {bk.status === 'CANCELLED' && bk.cancelledBy === 'CLINIC' ? (
        <Callout
          tone="bad"
          icon="close-circle-outline"
          title={t('bookings.cancelledByClinic')}
          body={`${bk.cancelReason ?? ''}${bk.paidOnline > 0 ? `\n${t('bookings.cancelledRefund')}` : ''}`}
        />
      ) : (
        !!bk.cancelReason && <T variant="muted">Reason: {bk.cancelReason}</T>
      )}
      {bk.status === 'BOOKED' && l?.canMove && <Button title={t('late.moveBooked')} tone="soft" icon="calendar-outline" loading={moving} onPress={moveNext} />}
      {active && (l ? l.canCancel : true) && (
        <>
          <Button
            title={t('bookings.cancel')}
            tone="outline"
            loading={cancel.isPending}
            onPress={async () => {
              if (await confirm(t('bookings.cancel'), t('bookings.cancelConfirm'), t('bookings.cancel'), true)) cancel.mutate();
            }}
          />
          {!!l && bk.status !== 'PENDING_PAYMENT' && (
            <T variant="small" style={{ color: C.muted, textAlign: 'center', marginTop: -4 }}>
              {t('bookings.cancelUntil', { time: `${dayLabel(bk.instance.date, t)}, ${timeOf(l.cancelUntil)}` })}
            </T>
          )}
        </>
      )}
      {active && !!l && !l.canCancel && ['BOOKED', 'LATE', 'PRESENT'].includes(bk.status) && (
        <Callout
          tone="warn"
          icon="lock-closed-outline"
          title={t('bookings.cancelClosedTitle')}
          body={`${t('bookings.cancelClosed')}\n\n${t('bookings.askClinic')}`}
          action={bk.clinic.phone ? t('bookings.callClinic') : undefined}
          onPress={bk.clinic.phone ? () => Linking.openURL(`tel:+91${bk.clinic.phone}`) : undefined}
        />
      )}
      {bk.status === 'SERVED' && !bk.review && <Button title={t('bookings.rate')} icon="star-outline" onPress={openRate} />}
      {bk.status === 'SERVED' && bk.review && (
        <Card>
          <T variant="label">{t('rate.yours')}</T>
          {bk.review.rating ? (
            <Row style={{ alignItems: 'center', marginTop: 6 }}>
              <T variant="small" style={{ flex: 1 }}>Dr. {bk.doctor.name}</T>
              <Stars value={bk.review.rating} />
            </Row>
          ) : null}
          {bk.review.clinicRating ? (
            <Row style={{ alignItems: 'center', marginTop: 6 }}>
              <T variant="small" style={{ flex: 1 }}>{bk.clinic.name}</T>
              <Stars value={bk.review.clinicRating} />
            </Row>
          ) : null}
          {bk.review.comment ? <T variant="small" style={{ marginTop: 6, color: C.muted }}>“{bk.review.comment}”</T> : null}
          <Button title={t('rate.edit')} tone="soft" icon="create-outline" style={{ marginTop: 10 }} onPress={openRate} />
        </Card>
      )}
      {!active && <Button title={t('bookings.rebook')} tone="soft" style={{ marginTop: 10 }} onPress={() => router.push(`/doctor/${bk.doctor.id}?clinicId=${bk.clinic.id}`)} />}
      <PaySheet
        payment={pay}
        prefill={{ name: user?.name, contact: user?.phone }}
        onDone={(ok, msg) => {
          setPay(null);
          b.refetch();
          if (!ok && msg) Alert.alert('Payment', msg);
        }}
      />
      <Sheet visible={rateOpen} onClose={() => setRateOpen(false)} title={t('rate.title')}>
        <T variant="label" style={{ textAlign: 'center' }}>{t('rate.doctor')}</T>
        <T variant="small" style={{ textAlign: 'center', color: C.muted, marginBottom: 6 }}>Dr. {bk.doctor.name}</T>
        <StarPicker value={rating} onChange={setRating} label={t('rate.doctor')} />
        <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
        <T variant="label" style={{ textAlign: 'center' }}>{t('rate.clinic')}</T>
        <T variant="small" style={{ textAlign: 'center', color: C.muted }}>{bk.clinic.name}</T>
        <T variant="small" style={{ textAlign: 'center', color: C.muted, marginBottom: 6 }}>{t('rate.clinicHint')}</T>
        <StarPicker value={clinicRating} onChange={setClinicRating} label={t('rate.clinic')} />
        <Input value={comment} onChangeText={setComment} multiline placeholder={t('rate.comment')} maxLength={500} style={{ marginTop: 14 }} />
        {!rating && !clinicRating ? <T variant="small" style={{ color: C.muted, textAlign: 'center', marginBottom: 8 }}>{t('rate.needOne')}</T> : null}
        <Button title={t('common.save')} disabled={!rating && !clinicRating} loading={review.isPending} onPress={() => review.mutate()} />
      </Sheet>
    </Screen>
  );
}
