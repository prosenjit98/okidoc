import type { PaymentMode } from '@okidoc/shared';
import { router } from '@/lib/nav';
import { View } from 'react-native';
import { Badge, Button, Card, Chip, ErrorView, KV, Loading, Row, Screen, Section, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { days, inr, t12 } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Settings {
  effectiveMode: PaymentMode;
  allowedModes: PaymentMode[];
  lockedBy: string | null;
  clinicSelectedMode: PaymentMode | null;
  fees: { bookingFeeEnabled: boolean; bookingFeePaise: number; commissionEnabled: boolean; commissionPercent: number; commissionFlatPaise: number; refundFullMinutes: number };
  doctors: {
    linkId: string;
    doctorName: string;
    consultationFee: number;
    clinicSplitPercent: number;
    mode: PaymentMode | null;
    sittings: { sittingId: string; weekdays: number[]; startTime: string; endTime: string; mode: PaymentMode | null }[];
  }[];
}

const MODE_LABEL: Record<PaymentMode, string> = { PAY_AT_CLINIC: 'Pay at clinic', ONLINE_BOOKING_FEE: 'Booking fee online', ONLINE_FULL: 'Full online prepayment' };

/** CLN-19 / PAY-03 fees & payment settings. Modes come from what the admin allows; locked settings are read-only. */
export default function Fees() {
  const t = useT();
  const { clinicId } = useClinic();
  const q = useApi<Settings>(['payment-settings', clinicId], clinicId ? `/clinic/${clinicId}/payment-settings` : null);
  const save = useAction((body: object) => api(`/clinic/${clinicId}/payment-settings`, { method: 'PUT', body }), { invalidate: [['payment-settings', clinicId]] });
  const s = q.data;
  const locked = !!s?.lockedBy;

  const ModeChips = ({ value, onPick, allowDefault }: { value: PaymentMode | null; onPick: (m: PaymentMode | null) => void; allowDefault?: boolean }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {allowDefault && <Chip label="Clinic default" active={!value} onPress={() => !locked && onPick(null)} />}
      {s!.allowedModes.map((m) => (
        <Chip key={m} label={MODE_LABEL[m]} active={value === m} onPress={() => !locked && onPick(m)} />
      ))}
    </View>
  );

  return (
    <Screen back tabs={false} title={t('more.fees')} subtitle={t('more.fees.desc')} onRefresh={q.refetch} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} />
      ) : s ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="label">How patients pay</T>
              {locked && <Badge text={t('book.setByOkidoc')} tone="info" />}
            </Row>
            <T variant="h2" style={{ marginTop: 4 }}>
              {MODE_LABEL[s.effectiveMode]}
            </T>
            {locked ? (
              <T variant="muted">Okidoc has set the payment mode for your clinic. Contact Okidoc to change it.</T>
            ) : (
              <>
                <T variant="muted" style={{ marginVertical: 8 }}>
                  Choose your default. Options shown are the ones Okidoc allows for your clinic.
                </T>
                <ModeChips value={s.clinicSelectedMode ?? s.effectiveMode} onPick={(m) => save.mutate({ defaultMode: m })} />
                {s.allowedModes.length === 1 && <T variant="muted">Online payment options can be enabled by Okidoc.</T>}
              </>
            )}
          </Card>
          <Card>
            <KV k="Booking fee" v={s.fees.bookingFeeEnabled ? inr(s.fees.bookingFeePaise) : 'Off'} />
            <KV k="Okidoc commission" v={s.fees.commissionEnabled ? `${s.fees.commissionPercent}%` : 'None (0%)'} />
            <KV k="Full refund if patient cancels" v={`${Math.round(s.fees.refundFullMinutes / 60)} h before`} />
          </Card>
          <Section title="Per doctor">
            {s.doctors.map((d) => (
              <Card key={d.linkId}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T variant="h3">Dr. {d.doctorName}</T>
                  <T style={{ fontWeight: '800', color: C.tealDark }}>{inr(d.consultationFee)}</T>
                </Row>
                <T variant="muted" style={{ marginBottom: 6 }}>
                  Clinic share {d.clinicSplitPercent}% · change fee in Doctors › {d.doctorName}
                </T>
                {!locked && s.allowedModes.length > 1 && (
                  <>
                    <ModeChips allowDefault value={d.mode} onPick={(m) => save.mutate({ doctorOverrides: [{ linkId: d.linkId, mode: m }] })} />
                    {d.sittings.map((st) => (
                      <View key={st.sittingId} style={{ marginTop: 6 }}>
                        <T variant="small" style={{ color: C.muted }}>
                          {days(st.weekdays)} · {t12(st.startTime)}–{t12(st.endTime)}
                        </T>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          <Chip label="Doctor default" active={!st.mode} onPress={() => save.mutate({ sittingOverrides: [{ sittingId: st.sittingId, mode: null }] })} />
                          {s.allowedModes.map((m) => (
                            <Chip key={m} label={MODE_LABEL[m]} active={st.mode === m} onPress={() => save.mutate({ sittingOverrides: [{ sittingId: st.sittingId, mode: m }] })} />
                          ))}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </Card>
            ))}
          </Section>
          <Button title="Payout details" tone="outline" onPress={() => router.push('/k/profile')} />
        </>
      ) : null}
    </Screen>
  );
}
