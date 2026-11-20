import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Bell } from '@/components/common';
import { Badge, Button, Card, Chip, Empty, Input, Loading, Locked, Row, Screen, Section, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { normalizePhone, t12, todayIST } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { isOnline, offlineWalkIns, onNetworkChange, type PendingWalkIn } from '@/lib/offline';
import { C } from '@/lib/theme';
import type { StaffView } from '@/lib/types';

/** CLN-12 fast walk-in entry, CLN-13 offline queue with automatic sync. */
export default function WalkIn() {
  const t = useT();
  const { clinicId, has, clinic } = useClinic();
  const q = useApi<{ doctors: StaffView[] }>(['clinic-queue', clinicId, todayIST()], clinicId ? `/clinic/${clinicId}/queue?date=${todayIST()}` : null);
  const open = (q.data?.doctors ?? []).filter((d) => d.snapshot.status !== 'ENDED' && d.snapshot.status !== 'CANCELLED');
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<{ token: number | string; name: string; doctor: string; offline?: boolean }[]>([]);
  const [pending, setPending] = useState<PendingWalkIn[]>([]);
  const [online, setOnline] = useState(true);
  const sel = open.find((d) => d.snapshot.instanceId === instanceId) ?? open[0];

  const refreshPending = useCallback(async () => {
    if (clinicId) setPending(await offlineWalkIns.list(clinicId));
  }, [clinicId]);

  const sync = useCallback(async () => {
    if (!clinicId) return;
    try {
      const r = await offlineWalkIns.sync(clinicId);
      if (r.synced.length) setRecent((x) => [...r.synced.map((s) => ({ token: s.tokenNo, name: s.name, doctor: '' })), ...x]);
      await refreshPending();
      q.refetch();
    } catch {
      /* stay queued */
    }
  }, [clinicId, refreshPending, q]);

  useEffect(() => {
    refreshPending();
    isOnline().then((o) => {
      setOnline(o);
      if (o) sync();
    });
    const sub = onNetworkChange((o) => {
      setOnline(o);
      if (o) sync();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  if (clinic && !has('WALK_IN'))
    return (
      <Screen title={t('tab.walkin')}>
        <Locked />
      </Screen>
    );

  const add = async () => {
    if (!sel || !clinicId || !name.trim()) return;
    const p = normalizePhone(phone);
    setBusy(true);
    const queueOffline = async () => {
      await offlineWalkIns.add({ clinicId, instanceId: sel.snapshot.instanceId, name: name.trim(), phone: p || undefined, doctorName: sel.doctor.name });
      setRecent((x) => [{ token: '…', name: name.trim(), doctor: sel.doctor.name, offline: true }, ...x]);
      await refreshPending();
    };
    try {
      if (!(await isOnline())) await queueOffline();
      else {
        const r = await api<{ booking: { tokenNo: number } }>(`/clinic/${clinicId}/instances/${sel.snapshot.instanceId}/walk-ins`, { body: { name: name.trim(), phone: p || undefined } });
        setRecent((x) => [{ token: r.booking.tokenNo, name: name.trim(), doctor: sel.doctor.name }, ...x]);
        q.refetch();
      }
      setName('');
      setPhone('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NETWORK') {
        await queueOffline();
        setName('');
        setPhone('');
      } else Alert.alert('Okidoc', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('tab.walkin')} subtitle={online ? 'Add patients at the desk' : t('common.offline')} right={<Bell />}>
      {!online && (
        <Card style={{ backgroundColor: C.warnSoft }}>
          <T color={C.warn}>Offline — walk-ins are saved on this device and sent automatically when the connection returns.</T>
        </Card>
      )}
      {q.isLoading ? (
        <Loading />
      ) : !open.length ? (
        <Empty icon="calendar-clear-outline" title="No open sittings today" />
      ) : (
        <>
          <T variant="label" style={{ marginBottom: 6 }}>
            Doctor
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {open.map((d) => (
              <Chip key={d.snapshot.instanceId} label={`Dr. ${d.doctor.name} · ${t12(d.snapshot.startTime)}`} active={sel?.snapshot.instanceId === d.snapshot.instanceId} onPress={() => setInstanceId(d.snapshot.instanceId)} />
            ))}
          </View>
          <Card>
            <Input label="Patient name" value={name} onChangeText={setName} autoFocus returnKeyType="next" />
            <Input label="Phone (optional — we SMS the token)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" onSubmitEditing={add} />
            <Button title="Add walk-in & give token" icon="person-add" disabled={!name.trim()} loading={busy} onPress={add} />
          </Card>
        </>
      )}
      {!!pending.length && (
        <Section title={`Waiting to sync · ${pending.length}`} action="Sync now" onAction={sync}>
          {pending.map((p) => (
            <Card key={p.clientRef}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="h3">{p.name}</T>
                <Badge text="offline" tone="warn" />
              </Row>
              <T variant="muted">Dr. {p.doctorName}</T>
            </Card>
          ))}
        </Section>
      )}
      {!!recent.length && (
        <Section title="Added just now">
          {recent.slice(0, 15).map((r, i) => (
            <Card key={i}>
              <Row>
                <Text style={{ fontSize: 22, fontWeight: '900', color: C.navy900, width: 64 }}>#{r.token}</Text>
                <View style={{ flex: 1 }}>
                  <T variant="h3">{r.name}</T>
                  {!!r.doctor && <T variant="muted">Dr. {r.doctor}</T>}
                </View>
                {r.offline && <Badge text="queued" tone="warn" />}
              </Row>
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}
