import { Alert } from 'react-native';
import { Card, ListItem, Screen, T } from '@/components/ui';
import { api, errMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { shareTextFile } from '@/lib/files';
import { confirm } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

/** DPDP: data export & account deletion (PAT-18, CLN-22). */
export default function Privacy() {
  const t = useT();
  const { logout } = useAuth();
  const exportData = async () => {
    try {
      const data = await api('/me/export');
      await shareTextFile('okidoc-my-data.json', JSON.stringify(data, null, 2));
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    }
  };
  const del = async () => {
    if (!(await confirm(t('account.delete'), t('account.deleteConfirm'), t('common.delete'), true))) return;
    try {
      await api('/me', { method: 'DELETE' });
      await logout();
    } catch (e) {
      Alert.alert('Okidoc', errMessage(e));
    }
  };
  return (
    <Screen back tabs={false} title={t('account.privacy')}>
      <Card>
        <T variant="muted">
          Okidoc uses your data only to run bookings and queues. Your records are visible only to you and doctors you share them with. Health data is never shared with advertisers. Grievance
          officer: grievance@okidoc.in
        </T>
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="download-outline" title={t('account.export')} onPress={exportData} />
        <ListItem icon="trash-outline" title={t('account.delete')} danger onPress={del} />
      </Card>
    </Screen>
  );
}
