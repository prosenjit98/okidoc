import { LANGUAGE_NAMES, LANGUAGES } from '@okidoc/shared';
import { router } from '@/lib/nav';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Avatar, Card, Chip, ListItem, Row, Sheet, T } from './ui';

/** Account items shared by every role (PAT-18, CLN-22, AUTH-11/13). */
export function AccountMenu({ patient }: { patient?: boolean }) {
  const { t, lang, setLang } = useI18n();
  const { user, logout } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  return (
    <>
      <Card onPress={() => router.push('/account/profile')}>
        <Row gap={14}>
          <Avatar name={user?.name ?? ''} size={54} />
          <View style={{ flex: 1 }}>
            <T variant="h2">{user?.name}</T>
            <T variant="muted">+91 {user?.phone}</T>
          </View>
        </Row>
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="person-outline" title={t('account.profile')} onPress={() => router.push('/account/profile')} />
        {patient && <ListItem icon="people-outline" title={t('account.family')} onPress={() => router.push('/account/family')} />}
        {patient && <ListItem icon="alert-circle-outline" title={t('account.standing')} onPress={() => router.push('/account/standing')} />}
        <ListItem icon="language-outline" title={t('account.language')} subtitle={LANGUAGE_NAMES[lang]} onPress={() => setLangOpen(true)} />
        <ListItem icon="notifications-outline" title={t('account.notifications')} onPress={() => router.push('/account/notification-settings')} />
        <ListItem icon="shield-checkmark-outline" title={t('account.security')} onPress={() => router.push('/account/security')} />
        <ListItem icon="swap-horizontal-outline" title={t('account.switchRole')} onPress={() => router.push('/account/roles')} />
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="help-buoy-outline" title={t('account.help')} onPress={() => router.push('/support')} />
        <ListItem icon="lock-closed-outline" title={t('account.privacy')} onPress={() => router.push('/account/privacy')} />
        <ListItem
          icon="log-out-outline"
          title={t('account.logout')}
          danger
          onPress={async () => {
            if (await confirm(t('account.logout'), 'You will need your phone number and password to log in again.', t('account.logout'), true)) logout();
          }}
        />
      </Card>
      <Sheet visible={langOpen} onClose={() => setLangOpen(false)} title={t('account.language')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l}
              label={LANGUAGE_NAMES[l]}
              active={lang === l}
              onPress={() => {
                setLang(l);
                api('/me', { method: 'PATCH', body: { language: l } }).catch(() => undefined);
                setLangOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </>
  );
}
