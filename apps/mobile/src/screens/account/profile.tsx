import { router } from '@/lib/nav';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Input, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAction } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

export default function Profile() {
  const t = useT();
  const { user, refreshMe } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [gender, setGender] = useState<string | null>(user?.gender ?? null);
  const [birthYear, setBirthYear] = useState(user?.birthYear ? String(user.birthYear) : '');
  const save = useAction(
    () => api('/me', { method: 'PATCH', body: { name: name.trim(), email: email.trim() || null, gender, birthYear: birthYear ? Number(birthYear) : null } }),
    { onSuccess: async () => { await refreshMe(); router.back(); } },
  );
  return (
    <Screen back tabs={false} title={t('account.profile')}>
      <Input label={t('auth.name')} value={name} onChangeText={setName} />
      <Input label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <T variant="label" style={{ marginBottom: 6 }}>
        Gender
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['FEMALE', 'MALE', 'OTHER'].map((g) => (
          <Chip key={g} label={g[0] + g.slice(1).toLowerCase()} active={gender === g} onPress={() => setGender(g)} />
        ))}
      </View>
      <Input label="Year of birth" value={birthYear} onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" />
      <T variant="muted" style={{ marginBottom: 12 }}>
        Phone: +91 {user?.phone} (cannot be changed)
      </T>
      <Button title={t('common.save')} loading={save.isPending} disabled={name.trim().length < 2} onPress={() => save.mutate()} />
    </Screen>
  );
}
