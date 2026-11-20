import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Screen, Section, T, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAction } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

const OPTIONAL: { type: string; label: string }[] = [
  { type: 'REMINDER', label: 'Visit reminders' },
  { type: 'DOCTOR_ONLINE', label: 'Doctor has started sitting' },
  { type: 'TURN_NEAR', label: 'Your turn is near' },
  { type: 'YOU_ARE_NEXT', label: "You're next" },
  { type: 'RATE_VISIT', label: 'Rate your visit' },
  { type: 'GENERAL', label: 'News from Okidoc' },
];

/** PRD §8: users can turn off non-critical notifications; OTP, payments and cancellations always arrive. */
export default function NotificationSettings() {
  const t = useT();
  const { user, refreshMe } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(user?.notifyPrefs ?? {});
  const [threshold, setThreshold] = useState(user?.turnNearThreshold ?? 3);
  const save = useAction(() => api('/me', { method: 'PATCH', body: { notifyPrefs: prefs, turnNearThreshold: threshold } }), { onSuccess: () => refreshMe() });
  return (
    <Screen back tabs={false} title={t('account.notifications')}>
      <Card style={{ paddingVertical: 4 }}>
        {OPTIONAL.map((o) => (
          <Toggle key={o.type} label={o.label} value={prefs[o.type] !== false} onChange={(v) => setPrefs({ ...prefs, [o.type]: v })} />
        ))}
      </Card>
      <Section title="Alert me when this many patients are ahead">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[1, 2, 3, 5, 8, 10].map((n) => (
            <Chip key={n} label={String(n)} active={threshold === n} onPress={() => setThreshold(n)} />
          ))}
        </View>
      </Section>
      <T variant="muted" style={{ marginVertical: 12 }}>
        Booking confirmations, payments, refunds, delays, cancellations and missed-visit notices are always sent.
      </T>
      <Button title={t('common.save')} loading={save.isPending} onPress={() => save.mutate()} />
    </Screen>
  );
}
