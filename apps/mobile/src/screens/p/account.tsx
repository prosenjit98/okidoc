import { AccountMenu } from '@/components/AccountMenu';
import { Bell } from '@/components/common';
import { Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';

export default function Account() {
  const t = useT();
  return (
    <Screen title={t('tab.account')} right={<Bell />}>
      <AccountMenu patient />
    </Screen>
  );
}
