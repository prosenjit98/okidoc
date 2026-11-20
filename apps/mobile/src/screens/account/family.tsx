import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Button, Card, Chip, Empty, Input, Loading, Row, Screen, Sheet, T } from '@/components/ui';
import { api } from '@/lib/api';
import { confirm, useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Member {
  id: string;
  name: string;
  relation: string;
  gender?: string | null;
  birthYear?: number | null;
}

/** Family members (BR-15: bookings only for the account holder or saved family). */
export default function Family() {
  const t = useT();
  const q = useApi<Member[]>(['family'], '/me/family');
  const [edit, setEdit] = useState<Partial<Member> | null>(null);
  const save = useAction(
    () =>
      edit?.id
        ? api(`/me/family/${edit.id}`, { method: 'PATCH', body: { name: edit.name, relation: edit.relation, gender: edit.gender ?? null, birthYear: edit.birthYear ?? null } })
        : api('/me/family', { body: { name: edit!.name, relation: edit!.relation, gender: edit!.gender ?? null, birthYear: edit!.birthYear ?? null } }),
    { invalidate: [['family']], onSuccess: () => setEdit(null) },
  );
  const remove = useAction((id: string) => api(`/me/family/${id}`, { method: 'DELETE' }), { invalidate: [['family']] });

  return (
    <Screen back tabs={false} title={t('account.family')} right={<Button small title={t('common.add')} icon="add" onPress={() => setEdit({ name: '', relation: '' })} />}>
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Empty icon="people-outline" title="No family members yet" body="Add family members to book visits for them." action={t('book.addFamily')} onAction={() => setEdit({ name: '', relation: '' })} />
      ) : (
        q.data.map((m) => (
          <Card key={m.id} onPress={() => setEdit(m)}>
            <Row gap={12}>
              <Avatar name={m.name} />
              <View style={{ flex: 1 }}>
                <T variant="h3">{m.name}</T>
                <T variant="muted">
                  {m.relation}
                  {m.birthYear ? ` · born ${m.birthYear}` : ''}
                </T>
              </View>
              <Pressable
                hitSlop={10}
                onPress={async () => {
                  if (await confirm(t('common.delete'), m.name, t('common.delete'), true)) remove.mutate(m.id);
                }}
              >
                <Ionicons name="trash-outline" size={20} color={C.bad} />
              </Pressable>
            </Row>
          </Card>
        ))
      )}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('common.edit') : t('book.addFamily')}>
        <Input label="Name" value={edit?.name ?? ''} onChangeText={(v) => setEdit({ ...edit, name: v })} />
        <Input label="Relation" value={edit?.relation ?? ''} onChangeText={(v) => setEdit({ ...edit, relation: v })} placeholder="Son, Mother, Spouse…" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['FEMALE', 'MALE', 'OTHER'].map((g) => (
            <Chip key={g} label={g[0] + g.slice(1).toLowerCase()} active={edit?.gender === g} onPress={() => setEdit({ ...edit, gender: g })} />
          ))}
        </View>
        <Input label="Year of birth" value={edit?.birthYear ? String(edit.birthYear) : ''} onChangeText={(v) => setEdit({ ...edit, birthYear: v ? Number(v.replace(/\D/g, '').slice(0, 4)) : null })} keyboardType="number-pad" />
        <Button title={t('common.save')} disabled={!edit?.name || !edit?.relation} loading={save.isPending} onPress={() => save.mutate()} />
      </Sheet>
    </Screen>
  );
}
