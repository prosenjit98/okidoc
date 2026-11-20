import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import type { QuoteView } from '@okidoc/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from '@/lib/nav';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { PaySheet, type GatewayPayment } from '@/components/PaySheet';
import { Button, Card, Chip, Divider, ErrorView, Input, KV, Loading, Row, Screen, Section, Sheet, T } from '@/components/ui';
import { api, errCode, errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dayLabel, inr, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Member {
  id: string;
  name: string;
  relation: string;
}

/** PAT-10 booking + PAY-05 checkout. Ad-free screen (MON-02). */
export default function Book() {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const p = useLocalSearchParams<{ sittingId: string; date: string; doctorId: string; clinic?: string; time?: string }>();
  const quote = useQuery<QuoteView & { instanceId: string }>({
    queryKey: ['quote', p.sittingId, p.date],
    queryFn: () => api('/bookings/quote', { body: { sittingId: p.sittingId, date: p.date } }),
    retry: false,
  });
  const q = quote.data ?? null;
  const qErr = quote.error;
  const family = useApi<Member[]>(['family'], '/me/family');
  const records = useApi<{ id: string; title: string; type: string }[]>(['records'], '/records');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [shared, setShared] = useState<string[]>([]);
  const [payment, setPayment] = useState<GatewayPayment | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relation: '' });

  const addMember = useAction(() => api<Member>('/me/family', { body: newMember }), {
    invalidate: [['family']],
    onSuccess: (m) => {
      setMemberId(m.id);
      setAddOpen(false);
      setNewMember({ name: '', relation: '' });
    },
  });

  const done = (id: string) => {
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ['slots'] });
    router.replace(`/p/bookings?booked=${id}`);
  };

  const book = useAction(
    () =>
      api<{ booking: { id: string; tokenNo: number }; payment: GatewayPayment | null }>('/bookings', {
        body: { sittingId: p.sittingId, date: p.date, memberId, note: note || undefined, sharedRecordIds: shared.length ? shared : undefined },
      }),
    {
      silent: true,
      onSuccess: (r) => {
        setBookingId(r.booking.id);
        if (r.payment) setPayment(r.payment);
        else done(r.booking.id);
      },
    },
  );

  const submit = () =>
    book.mutate(undefined, {
      onError: (e) => {
        Alert.alert(errCode(e) === 'PATIENT_BLOCKED' ? t('book.blocked') : 'Okidoc', errMessage(e), errCode(e) === 'PATIENT_BLOCKED' ? [{ text: 'OK' }, { text: t('account.help'), onPress: () => router.push('/support?category=BLOCK_APPEAL') }] : undefined);
      },
    });

  const modeText = q ? (q.paymentMode === 'PAY_AT_CLINIC' ? t('book.modePayAtClinic') : q.paymentMode === 'ONLINE_BOOKING_FEE' ? t('book.modeBookingFee') : t('book.modeFull')) : '';

  return (
    <Screen back tabs={false} title={t('book.title')} subtitle={`${p.clinic ?? ''} · ${dayLabel(p.date, t)} · ${p.time ? p.time.split('-').map(t12).join(' – ') : ''}`}>
      {qErr ? (
        <ErrorView error={qErr} />
      ) : !q ? (
        <Loading />
      ) : (
        <>
          {q.blocked && (
            <Card style={{ backgroundColor: C.badSoft }}>
              <Row>
                <Ionicons name="ban-outline" size={20} color={C.bad} />
                <T variant="h3" color={C.bad}>
                  {t('book.blocked')}
                </T>
              </Row>
              <T style={{ marginTop: 6 }}>{q.blocked.reason}. You can still visit as a walk-in at the clinic desk.</T>
              <Button small tone="outline" title="Appeal" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => router.push('/support?category=BLOCK_APPEAL')} />
            </Card>
          )}
          {q.bookable !== 'OK' && !q.blocked && (
            <Card style={{ backgroundColor: C.warnSoft }}>
              <T color={C.warn}>This sitting cannot be booked right now ({q.bookable.replace(/_/g, ' ').toLowerCase()}).</T>
            </Card>
          )}
          <Section title={t('book.for')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip label={`${t('book.myself')} (${user?.name ?? ''})`} active={!memberId} onPress={() => setMemberId(null)} />
              {family.data?.map((m) => (
                <Chip key={m.id} label={`${m.name} · ${m.relation}`} active={memberId === m.id} onPress={() => setMemberId(m.id)} />
              ))}
              <Chip label={t('book.addFamily')} icon="add" onPress={() => setAddOpen(true)} />
            </View>
            <T variant="muted">Only you and family members saved on your account can be booked.</T>
          </Section>
          <Section title={t('book.note')}>
            <Input value={note} onChangeText={setNote} multiline maxLength={300} placeholder="e.g. follow-up, fever since 3 days" />
          </Section>
          {!!records.data?.length && (
            <Section title={t('book.shareRecords')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {records.data.slice(0, 10).map((r) => (
                  <Chip key={r.id} label={r.title} icon="document-outline" active={shared.includes(r.id)} onPress={() => setShared(shared.includes(r.id) ? shared.filter((x) => x !== r.id) : [...shared, r.id])} />
                ))}
              </View>
            </Section>
          )}
          <Card style={{ marginTop: 16 }}>
            <KV k={t('book.fee')} v={inr(q.breakdown.consultationFee)} />
            {q.breakdown.bookingFee > 0 && <KV k={t('book.bookingFee')} v={inr(q.breakdown.bookingFee)} />}
            {q.breakdown.tax > 0 && <KV k={t('book.tax')} v={inr(q.breakdown.tax)} />}
            <Divider />
            <KV k={t('book.payNow')} v={inr(q.breakdown.payableNow)} bold />
            <KV k={t('book.payAtClinic')} v={inr(q.breakdown.payableAtClinic)} bold />
            <T variant="muted" style={{ marginTop: 6 }}>
              {modeText}
              {q.lockedBy ? ` · ${t('book.setByOkidoc')}` : ''}
            </T>
          </Card>
          {q.paymentMode === 'PAY_AT_CLINIC' && (
            <Pressable style={{ flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.warnSoft, borderRadius: 14, marginBottom: 12 }}>
              <Ionicons name="information-circle-outline" size={20} color={C.warn} />
              <Text style={{ flex: 1, color: '#92400E', fontSize: 13 }}>{t('book.noShowPolicy')}</Text>
            </Pressable>
          )}
          <Button title={q.breakdown.payableNow > 0 ? `${t('book.confirm')} · ${inr(q.breakdown.payableNow)}` : t('book.confirm')} disabled={q.bookable !== 'OK' || !!q.blocked} loading={book.isPending} onPress={submit} />
        </>
      )}
      <PaySheet
        payment={payment}
        prefill={{ name: user?.name, contact: user?.phone }}
        onDone={(ok, msg) => {
          setPayment(null);
          if (ok && bookingId) done(bookingId);
          else if (bookingId) {
            Alert.alert('Payment not completed', `${msg ?? ''}\nYour place is held for a few minutes — you can retry from Bookings.`.trim(), [{ text: 'OK', onPress: () => router.replace(`/booking/${bookingId}`) }]);
          }
        }}
      />
      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title={t('book.addFamily')}>
        <Input label="Name" value={newMember.name} onChangeText={(v) => setNewMember({ ...newMember, name: v })} />
        <Input label="Relation" value={newMember.relation} onChangeText={(v) => setNewMember({ ...newMember, relation: v })} placeholder="Son, Mother, Spouse…" />
        <Button title={t('common.add')} disabled={!newMember.name || !newMember.relation} loading={addMember.isPending} onPress={() => addMember.mutate()} />
      </Sheet>
    </Screen>
  );
}
