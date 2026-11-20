/**
 * AdMob (MON-02/03/05) via react-native-google-mobile-ads.
 *  - Google UMP consent is gathered once at start-up (EEA/UK etc.); India users usually see no form.
 *  - Every request is NON-PERSONALISED (MON-05): no health data or interest targeting is ever sent.
 *  - App IDs live in app.json ("react-native-google-mobile-ads"); unit IDs come from the API (/ads/slot), seeded
 *    with Google's public test units. In __DEV__ the library's TestIds are always used.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { C } from '@/lib/theme';

const REQUEST = { requestNonPersonalizedAdsOnly: true } as const;
let ready: Promise<boolean> | null = null;

/** Consent (UMP) + SDK initialisation. Safe to call repeatedly. */
export function initAds(): Promise<boolean> {
  ready ??= (async () => {
    try {
      await AdsConsent.gatherConsent().catch(() => undefined);
      await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.T, tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false });
      await mobileAds().initialize();
      return true;
    } catch {
      return false;
    }
  })();
  return ready;
}

const unit = (id: string | null | undefined, test: string) => (__DEV__ ? test : id ?? test);

/** Banner for HOME_BANNER / SEARCH_SPONSORED fallbacks. */
export function AdMobBanner({ unitId, onShown }: { unitId: string | null; onShown?: () => void }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <View style={{ alignItems: 'center', marginBottom: 12 }}>
      <BannerAd unitId={unit(unitId, TestIds.ADAPTIVE_BANNER)} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={REQUEST} onAdLoaded={onShown} onAdFailedToLoad={() => setOk(false)} />
    </View>
  );
}

/** Native ad card for HOME_NATIVE (labelled "Sponsored" like house ads). */
export function AdMobNative({ unitId, onShown }: { unitId: string | null; onShown?: () => void }) {
  const [ad, setAd] = useState<NativeAd | null>(null);
  useEffect(() => {
    let alive = true;
    let loaded: NativeAd | null = null;
    initAds()
      .then(() => NativeAd.createForAdRequest(unit(unitId, TestIds.NATIVE), REQUEST))
      .then((a) => {
        loaded = a;
        if (alive) {
          setAd(a);
          onShown?.();
        } else a.destroy();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      loaded?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);
  if (!ad) return null;
  return (
    <NativeAdView nativeAd={ad} style={{ backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.tealSoft }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>Sponsored</Text>
        {!!ad.advertiser && (
          <NativeAsset assetType={NativeAssetType.ADVERTISER}>
            <Text style={{ color: C.faint, fontSize: 11 }}>{ad.advertiser}</Text>
          </NativeAsset>
        )}
      </View>
      <NativeAsset assetType={NativeAssetType.HEADLINE}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.navy900 }}>{ad.headline}</Text>
      </NativeAsset>
      <NativeAsset assetType={NativeAssetType.BODY}>
        <Text style={{ color: C.muted, marginTop: 4 }}>{ad.body}</Text>
      </NativeAsset>
      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <Text style={{ color: C.tealDark, fontWeight: '800', marginTop: 8 }}>{ad.callToAction}</Text>
      </NativeAsset>
    </NativeAdView>
  );
}

/** Post-booking interstitial (caller enforces the once-a-day cap). Resolves when closed or failed. */
export function showAdMobInterstitial(unitId: string | null): Promise<void> {
  return new Promise((resolve) => {
    initAds().then(() => {
      const ad = InterstitialAd.createForAdRequest(unit(unitId, TestIds.INTERSTITIAL), REQUEST);
      const subs = [
        ad.addAdEventListener(AdEventType.LOADED, () => ad.show().catch(() => resolve())),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          subs.forEach((u) => u());
          resolve();
        }),
        ad.addAdEventListener(AdEventType.ERROR, () => {
          subs.forEach((u) => u());
          resolve();
        }),
      ];
      ad.load();
    });
  });
}
