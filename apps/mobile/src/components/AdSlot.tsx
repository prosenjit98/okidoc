import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Platform, Text, View } from 'react-native';
import type { AdPlacementKey } from '@okidoc/shared';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { prefs } from '@/lib/storage';
import { todayIST } from '@/lib/format';
import { C } from '@/lib/theme';
import { AdMobBanner, AdMobNative, showAdMobInterstitial } from './admob';
import { Badge, Button, Card, T } from './ui';

type Slot =
  | { enabled: false; reason: string }
  | { enabled: true; type: 'HOUSE'; campaign: { id: string; advertiser: string; title: string; body: string | null; imageUrl: string | null; ctaLabel: string | null; ctaUrl: string | null } }
  | { enabled: true; type: 'ADMOB'; unitId: string | null };

function useSlot(placement: AdPlacementKey, areaId?: string | null) {
  return useQuery<Slot>({
    queryKey: ['ad', placement, areaId ?? ''],
    queryFn: () => api<Slot>(`/ads/slot?placement=${placement}&platform=${Platform.OS}${areaId ? `&areaId=${areaId}` : ''}`, { auth: false }),
    staleTime: 5 * 60_000,
  });
}

const sendEvent = (placement: string, type: 'IMPRESSION' | 'CLICK', campaignId?: string, source: 'HOUSE' | 'ADMOB' = 'HOUSE') =>
  api('/ads/events', { body: { placement, type, campaignId, source } }).catch(() => undefined);

function HouseAd({ placement, c, compact }: { placement: string; c: Extract<Slot, { type: 'HOUSE' }>['campaign']; compact?: boolean }) {
  const t = useT();
  const seen = useRef(false);
  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      sendEvent(placement, 'IMPRESSION', c.id);
    }
  }, [placement, c.id]);
  const open = () => {
    sendEvent(placement, 'CLICK', c.id);
    if (c.ctaUrl) Linking.openURL(c.ctaUrl).catch(() => undefined);
  };
  return (
    <Card onPress={open} style={{ borderWidth: 1, borderColor: C.tealSoft }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Badge text={t('common.sponsored')} tone="muted" />
        <Text style={{ color: C.faint, fontSize: 11 }}>{c.advertiser}</Text>
      </View>
      {!compact && !!c.imageUrl && <Image source={{ uri: c.imageUrl }} style={{ height: 120, borderRadius: 12, marginBottom: 8 }} resizeMode="cover" />}
      <T variant="h3">{c.title}</T>
      {!!c.body && <T variant="muted" style={{ marginTop: 4 }}>{c.body}</T>}
      {!!c.ctaLabel && (
        <Text style={{ color: C.tealDark, fontWeight: '800', marginTop: 8 }}>
          {c.ctaLabel} <Ionicons name="open-outline" size={13} />
        </Text>
      )}
    </Card>
  );
}

/**
 * MON-02 ad placement. Direct (house) campaigns from /ads/slot are preferred; otherwise AdMob.
 * Only use on: Home banner, Home native card, search sponsored slot.
 * Never render on live queue, checkout/payment, OTP, passcode or records screens.
 */
export function AdSlot({
  placement,
  areaId,
  compact,
  notSameAs,
}: {
  placement: Exclude<AdPlacementKey, 'POST_BOOKING_INTERSTITIAL'>;
  areaId?: string | null;
  compact?: boolean;
  /** Hide this slot when the given placement on the same screen already shows the same house campaign. */
  notSameAs?: AdPlacementKey;
}) {
  const q = useSlot(placement, areaId);
  const other = useSlot(notSameAs ?? placement, areaId);
  const slot = q.data;
  if (!slot || !slot.enabled) return null;
  if (slot.type === 'HOUSE') {
    const o = notSameAs ? other.data : undefined;
    if (o && o.enabled && o.type === 'HOUSE' && o.campaign.id === slot.campaign.id) return null;
    return <HouseAd placement={placement} c={slot.campaign} compact={compact} />;
  }
  if (!slot.unitId) return null;
  const shown = () => sendEvent(placement, 'IMPRESSION', undefined, 'ADMOB');
  return placement === 'HOME_NATIVE' ? <AdMobNative unitId={slot.unitId} onShown={shown} /> : <AdMobBanner unitId={slot.unitId} onShown={shown} />;
}

/** Post-booking interstitial, capped at once per day (MON-02). House campaign first, AdMob otherwise. */
export function PostBookingInterstitial({ trigger }: { trigger: boolean }) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const q = useSlot('POST_BOOKING_INTERSTITIAL');
  useEffect(() => {
    const slot = q.data;
    if (!trigger || !slot?.enabled) return;
    (async () => {
      const last = await prefs.get<string | null>('ads.interstitial', null);
      if (last === todayIST()) return;
      await prefs.set('ads.interstitial', todayIST());
      if (slot.type === 'HOUSE') setTimeout(() => setVisible(true), 1200);
      else if (slot.unitId) {
        sendEvent('POST_BOOKING_INTERSTITIAL', 'IMPRESSION', undefined, 'ADMOB');
        await showAdMobInterstitial(slot.unitId);
      }
    })();
  }, [trigger, q.data]);
  if (!q.data?.enabled || q.data.type !== 'HOUSE') return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(7,29,41,0.7)', justifyContent: 'center', padding: 24 }}>
        <HouseAd placement="POST_BOOKING_INTERSTITIAL" c={q.data.campaign} />
        <Button title={t('common.close')} tone="outline" onPress={() => setVisible(false)} />
      </View>
    </Modal>
  );
}
