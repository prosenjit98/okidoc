import { router } from '@/lib/nav';
import { Bell } from '@/components/common';
import { Badge, Card, ListItem, Screen, type IconName } from '@/components/ui';
import { useClinic } from '@/lib/clinic';
import { inr } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import type { I18nKey } from '@okidoc/shared';

/** CLN-16..28 More menu (matches the "All your clinic tools, in one place" screen). */
export default function More() {
  const t = useT();
  const { clinicId, has } = useClinic();
  const bonus = useApi<{ summary: { patients: number; doctorsCompleted: number; payablePaise: number } }>(['bonuses', clinicId], clinicId && has('BONUSES') ? `/clinic/${clinicId}/bonuses` : null);
  const items: { icon: IconName; title: I18nKey; desc?: I18nKey; sub?: string; href: string; feature?: string }[] = [
    { icon: 'person-circle-outline', title: 'more.queueManager', desc: 'more.queueManager.desc', href: '/k/staff', feature: 'QUEUE_MANAGER' },
    { icon: 'cash-outline', title: 'more.earnings', desc: 'more.earnings.desc', href: '/k/earnings', feature: 'EARNINGS' },
    { icon: 'storefront-outline', title: 'more.profile', desc: 'more.profile.desc', href: '/k/profile' },
    { icon: 'card-outline', title: 'more.fees', desc: 'more.fees.desc', href: '/k/fees' },
    { icon: 'star-outline', title: 'more.reviews', desc: 'more.reviews.desc', href: '/k/reviews' },
    { icon: 'share-social-outline', title: 'more.poster', desc: 'more.poster.desc', href: '/k/poster', feature: 'DOCTORS_POSTER' },
    { icon: 'swap-horizontal-outline', title: 'more.openSlots', desc: 'more.openSlots.desc', href: '/k/openslots', feature: 'OPEN_SLOTS' },
    {
      icon: 'gift-outline',
      title: 'more.bonuses',
      sub: bonus.data ? `${bonus.data.summary.patients} patients · ${bonus.data.summary.doctorsCompleted} doctors completed · Payable ${inr(bonus.data.summary.payablePaise)}` : undefined,
      href: '/k/bonuses',
      feature: 'BONUSES',
    },
    { icon: 'ribbon-outline', title: 'more.subscription', href: '/k/subscription' },
    { icon: 'ban-outline', title: 'more.blocks', href: '/k/blocks' },
    { icon: 'globe-outline', title: 'more.support', desc: 'more.support.desc', href: '/support' },
    { icon: 'shield-checkmark-outline', title: 'more.security', desc: 'more.security.desc', href: '/k/account' },
  ];
  return (
    <Screen title={t('more.title')} subtitle={t('more.subtitle')} right={<Bell />}>
      {items.map((it) => {
        const locked = it.feature ? !has(it.feature) : false;
        return (
          <Card key={it.href} style={{ paddingVertical: 2 }}>
            <ListItem icon={it.icon} title={t(it.title)} subtitle={it.sub ?? (it.desc ? t(it.desc) : undefined)} onPress={() => router.push(it.href as never)} right={locked ? <Badge text="locked" tone="muted" /> : undefined} />
          </Card>
        );
      })}
      <Card style={{ paddingVertical: 2 }}>
        <ListItem icon="business-outline" title="Switch clinic" onPress={() => router.push('/k/select')} />
      </Card>
    </Screen>
  );
}
