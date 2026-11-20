import { AccountMenu } from '@/components/AccountMenu';
import { Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';

/** CLN-22 account, security & privacy (also used by Queue Managers). */
export default function ClinicAccount() {
  const t = useT();
  return (
    <Screen back tabs={false} title={t('more.security')}>
      <AccountMenu />
    </Screen>
  );
}
