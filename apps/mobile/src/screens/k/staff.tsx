import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Card, Empty, Input, Locked, Row, Screen, Sheet, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useClinic } from '@/lib/clinic';
import { normalizePhone } from '@/lib/format';
import { confirm, useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

interface Staff {
  assignmentId: string;
  id: string;
  name: string;
  phone: string;
}

/** CLN-16 Queue Manager accounts (restricted: queue, walk-ins, records only). */
export default function StaffScreen() {
  const t = useT();
  const { clinicId, has, clinic } = useClinic();
  const q = useApi<Staff[]>(['staff', clinicId], clinicId ? `/clinic/${clinicId}/staff` : null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', password: '' });
  const add = useAction(() => api(`/clinic/${clinicId}/staff`, { body: { name: f.name, phone: normalizePhone(f.phone), password: f.password } }), {
    invalidate: [['staff', clinicId]],
    onSuccess: () => {
      setOpen(false);
      setF({ name: '', phone: '', password: '' });
    },
  });
  const remove = useAction((id: string) => api(`/clinic/${clinicId}/staff/${id}`, { method: 'DELETE' }), { invalidate: [['staff', clinicId]] });
  if (clinic && !has('QUEUE_MANAGER')) return <Screen back tabs={false} title={t('more.queueManager')}><Locked /></Screen>;
  const limit = clinic?.entitlements.limits.MAX_QUEUE_MANAGERS;
  return (
    <Screen back tabs={false} title={t('more.queueManager')} subtitle={t('more.queueManager.desc')} right={<Button small icon="add" title={t('common.add')} onPress={() => setOpen(true)} />}>
      {limit != null && <T variant="muted" style={{ marginBottom: 8 }}>Your plan allows up to {limit} Queue Managers.</T>}
      {!q.data?.length ? (
        <Empty icon="person-add-outline" title="No Queue Managers yet" body="Give front-desk staff their own login. They can run the queue and add walk-ins, but cannot see money or settings." action={t('common.add')} onAction={() => setOpen(true)} />
      ) : (
        q.data.map((s) => (
          <Card key={s.assignmentId}>
            <Row gap={12}>
              <Avatar name={s.name} />
              <View style={{ flex: 1 }}>
                <T variant="h3">{s.name}</T>
                <T variant="muted">+91 {s.phone}</T>
              </View>
              <Button
                small
                tone="outline"
                title="Remove"
                onPress={async () => {
                  if (await confirm('Remove Queue Manager', s.name, 'Remove', true)) remove.mutate(s.assignmentId);
                }}
              />
            </Row>
          </Card>
        ))
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title="New Queue Manager">
        <Input label="Name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Input label="Mobile number" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
        <Input label="Temporary password" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry hint={t('auth.passwordHint')} />
        <Button title={t('common.add')} disabled={!f.name || !/^[6-9]\d{9}$/.test(normalizePhone(f.phone)) || f.password.length < 8} loading={add.isPending} onPress={() => add.mutate()} />
      </Sheet>
    </Screen>
  );
}
