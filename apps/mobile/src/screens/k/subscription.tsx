import { FEATURE_LABELS, type FeatureKey } from '@okidoc/shared';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { PaySheet, type GatewayPayment } from '@/components/PaySheet';
import { Badge, Button, Card, ErrorView, KV, Loading, Row, Screen, Section, statusTone, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { dateTime, inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';
import type { Entitlements } from '@/lib/types';

interface Sub {
  enabled: boolean;
  message: string | null;
  currentPlanCode: string | null;
  entitlements: Entitlements;
  usage: { doctors: number; sittings: number; queueManagers: number };
  plans: { id: string; code: string; name: string; priceMonthlyPaise: number; trialDays: number }[];
  subscription: { status: string; currentPeriodEnd?: string | null; trialEndsAt?: string | null; plan: { name: string } } | null;
  invoices: { id: string; number: string; amountPaise: number; status: string; issuedAt: string }[];
}

/** CLN-28 / MON-04 plan & features. While subscriptions are off it only shows that everything is free. */
export default function Subscription() {
  const t = useT();
  const { clinicId } = useClinic();
  const q = useApi<Sub>(['subscription', clinicId], clinicId ? `/clinic/${clinicId}/subscription` : null);
  const [pay, setPay] = useState<GatewayPayment | null>(null);
  const subscribe = useAction((planId: string) => api<{ status: string; payment?: GatewayPayment }>(`/clinic/${clinicId}/subscription`, { body: { planId } }), {
    invalidate: [['subscription', clinicId], ['clinic-info']],
    onSuccess: (r) => (r.payment ? setPay(r.payment) : Alert.alert('Plan updated', r.status)),
  });
  const payInvoice = useAction((id: string) => api<GatewayPayment>(`/clinic/${clinicId}/subscription/invoices/${id}/pay`, { body: {} }), { onSuccess: setPay });
  const s = q.data;
  const ent = s?.entitlements;
  return (
    <Screen back tabs={false} title={t('more.subscription')}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} />
      ) : s ? (
        <>
          <Card style={!s.enabled ? { backgroundColor: C.tealSoft } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h2">{s.subscription?.plan.name ?? s.currentPlanCode ?? 'Free'}</T>
              {s.subscription && <Badge text={s.subscription.status.toLowerCase()} tone={statusTone(s.subscription.status)} />}
            </Row>
            {!s.enabled && <T style={{ marginTop: 6 }}>{s.message ?? t('pilot.free')}</T>}
            {s.subscription?.currentPeriodEnd && <T variant="muted">Renews {dateTime(s.subscription.currentPeriodEnd)}</T>}
          </Card>
          <Card>
            <KV k="Doctors" v={`${s.usage.doctors}${ent?.limits.MAX_DOCTORS != null ? ` / ${ent.limits.MAX_DOCTORS}` : ''}`} />
            <KV k="Weekly sittings" v={`${s.usage.sittings}${ent?.limits.MAX_SITTINGS != null ? ` / ${ent.limits.MAX_SITTINGS}` : ''}`} />
            <KV k="Queue Managers" v={`${s.usage.queueManagers}${ent?.limits.MAX_QUEUE_MANAGERS != null ? ` / ${ent.limits.MAX_QUEUE_MANAGERS}` : ''}`} />
          </Card>
          <Section title="Included features">
            <Card>
              {ent &&
                (Object.keys(ent.features) as FeatureKey[]).map((k) => (
                  <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
                    <T variant="small">{FEATURE_LABELS[k] ?? k}</T>
                    <Badge text={ent.features[k] ? 'on' : 'off'} tone={ent.features[k] ? 'ok' : 'muted'} />
                  </Row>
                ))}
            </Card>
          </Section>
          {s.enabled && (
            <Section title="Plans">
              {s.plans.map((p) => (
                <Card key={p.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View>
                      <T variant="h3">{p.name}</T>
                      <T variant="muted">
                        {p.priceMonthlyPaise ? `${inr(p.priceMonthlyPaise)} / month + GST` : t('common.free')}
                        {p.trialDays ? ` · ${p.trialDays}-day trial` : ''}
                      </T>
                    </View>
                    {s.currentPlanCode === p.code ? <Badge text="current" tone="ok" /> : <Button small title="Choose" loading={subscribe.isPending} onPress={() => subscribe.mutate(p.id)} />}
                  </Row>
                </Card>
              ))}
            </Section>
          )}
          {!!s.invoices.length && (
            <Section title="Invoices">
              {s.invoices.map((i) => (
                <Card key={i.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View>
                      <T variant="h3">{i.number}</T>
                      <T variant="muted">
                        {inr(i.amountPaise)} · {dateTime(i.issuedAt)}
                      </T>
                    </View>
                    {i.status === 'DUE' ? <Button small title="Pay" onPress={() => payInvoice.mutate(i.id)} /> : <Badge text={i.status.toLowerCase()} tone={statusTone(i.status)} />}
                  </Row>
                </Card>
              ))}
            </Section>
          )}
        </>
      ) : null}
      <PaySheet
        payment={pay}
        onDone={(ok, msg) => {
          setPay(null);
          q.refetch();
          if (!ok && msg) Alert.alert('Payment', msg);
        }}
      />
    </Screen>
  );
}
