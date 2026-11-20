import { router } from '@/lib/nav';
import { useEffect } from 'react';
import { Share, Text, View } from 'react-native';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** AUTH-10 backup code, shown once after sign-up. */
export default function Backup() {
  const t = useT();
  const { flow } = useAuth();
  useEffect(() => {
    if (!flow.backupCode) router.replace('/quick-setup');
  }, [flow.backupCode]);
  if (!flow.backupCode) return null;
  return (
    <AuthShell
      title={t('auth.backupTitle')}
      subtitle={t('auth.backupBody')}
      footer={
        <View style={{ gap: 10 }}>
          <Button title="Share / save" tone="outline" icon="share-outline" onPress={() => Share.share({ message: `Okidoc backup code: ${flow.backupCode}` })} />
          <Button title={t('auth.backupSaved')} onPress={() => router.replace('/quick-setup')} />
        </View>
      }
    >
      <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 18, padding: 24, alignItems: 'center', marginTop: 20 }}>
        <Text selectable style={{ fontSize: 30, fontWeight: '900', letterSpacing: 3, color: C.navy900 }}>
          {flow.backupCode}
        </Text>
      </View>
    </AuthShell>
  );
}
