import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import LinearGradient from 'react-native-linear-gradient';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { I18nKey } from '@okidoc/shared';
import { BrandMark, Wordmark } from '@/components/Brand';
import { Avatar, Button, Glow } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { router } from '@/lib/nav';
import { prefs } from '@/lib/storage';
import { C, GRADIENT, SHADOW } from '@/lib/theme';

/** Set once the first-launch introduction has been seen (per install). */
export const INTRO_SEEN_KEY = 'intro.seen';

const SLIDES: { key: string; title: I18nKey; body: I18nKey; art: () => React.ReactElement }[] = [
  { key: 'find', title: 'intro.s1.title', body: 'intro.s1.body', art: () => <ArtFind /> },
  { key: 'book', title: 'intro.s2.title', body: 'intro.s2.body', art: () => <ArtBook /> },
  { key: 'live', title: 'intro.s3.title', body: 'intro.s3.body', art: () => <ArtLive /> },
  { key: 'safe', title: 'intro.s4.title', body: 'intro.s4.body', art: () => <ArtSafe /> },
];

/** First-launch introduction (shown once after install, before Welcome / sign-up). */
export default function Intro() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const list = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const artH = Math.min(340, height * 0.4);

  const finish = async (to: string) => {
    await prefs.set(INTRO_SEEN_KEY, true);
    router.replace(to);
  };
  const goTo = (i: number) => list.current?.scrollTo({ x: i * width, animated: true });

  return (
    <LinearGradient colors={[...GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <Glow size={420} top={-180} right={-200} opacity={0.14} />
      <Glow size={300} top={-60} right={-90} ring opacity={0.22} />
      <Glow size={380} bottom={-200} left={-170} opacity={0.1} />

      {/* top bar */}
      <View style={[st.top, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandMark size={34} glow={false} />
          <Wordmark size={22} />
        </View>
        {!last && (
          <Pressable onPress={() => finish('/welcome')} hitSlop={12} style={st.skip} accessibilityRole="button">
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 13.5 }}>{t('intro.skip')}</Text>
          </Pressable>
        )}
      </View>

      {/* slides */}
      <Animated.ScrollView
        ref={list as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map((sl, i) => {
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          const artScale = x.interpolate({ inputRange: range, outputRange: [0.86, 1, 0.86], extrapolate: 'clamp' });
          const fade = x.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          return (
            <View key={sl.key} style={{ width, paddingHorizontal: 26, justifyContent: 'center' }} accessible accessibilityLabel={`${t(sl.title)}. ${t(sl.body)}`}>
              <Animated.View style={{ height: artH, alignItems: 'center', justifyContent: 'center', transform: [{ scale: artScale }], opacity: fade }} importantForAccessibility="no-hide-descendants">
                {sl.art()}
              </Animated.View>
              <Animated.View style={{ opacity: fade, marginTop: 26 }}>
                <Text style={st.title}>{t(sl.title)}</Text>
                <Text style={st.body}>{t(sl.body)}</Text>
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>

      {/* dots + actions */}
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 22 }}>
        <View style={st.dots} accessibilityLabel={`${index + 1} / ${SLIDES.length}`}>
          {SLIDES.map((sl, i) => {
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            return (
              <Animated.View
                key={sl.key}
                style={[
                  st.dot,
                  {
                    width: x.interpolate({ inputRange: range, outputRange: [8, 26, 8], extrapolate: 'clamp' }),
                    opacity: x.interpolate({ inputRange: range, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' }),
                  },
                ]}
              />
            );
          })}
        </View>
        {last ? (
          <View style={{ gap: 12 }}>
            <Button title={t('intro.start')} iconRight="arrow-forward" onPress={() => finish('/language')} />
            <Pressable onPress={() => finish('/login')} style={st.secondary} accessibilityRole="button">
              <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>{t('intro.haveAccount')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button title={t('intro.next')} iconRight="arrow-forward" onPress={() => goTo(index + 1)} style={{ paddingHorizontal: 30 }} />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------- illustrations (built from real UI pieces)

function Glass({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[st.glass, style]}>{children}</View>;
}

function ArtFind() {
  return (
    <View style={{ width: 300 }}>
      <View style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }]}>
        <Ionicons name="search" size={20} color={C.tealDark} />
        <Text style={{ color: C.navy900, fontWeight: '700', fontSize: 15, flex: 1 }}>Knee pain</Text>
        <View style={st.pill}>
          <Text style={{ color: C.tealDark, fontWeight: '800', fontSize: 11 }}>Barasat</Text>
        </View>
      </View>
      {[
        { n: 'Dr. Ananya Ghosh', sp: 'Bone & joint · 12 yrs', tag: 'Live now', live: true },
        { n: 'Dr. Sourav Banerjee', sp: 'Orthopedics · 9 yrs', tag: '6 PM today', live: false },
      ].map((d, i) => (
        <View key={d.n} style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, marginLeft: i * 14, marginRight: -i * 6 }]}>
          <Avatar name={d.n} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.navy900, fontWeight: '800', fontSize: 14 }}>{d.n}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{d.sp}</Text>
          </View>
          <View style={[st.pill, d.live && { backgroundColor: C.okSoft }]}>
            <Text style={{ color: d.live ? C.ok : C.tealDark, fontWeight: '800', fontSize: 10.5 }}>{d.tag}</Text>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, justifyContent: 'center' }}>
        {['English', 'বাংলা', 'हिन्दी'].map((l) => (
          <Glass key={l} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 12 }}>{l}</Text>
          </Glass>
        ))}
      </View>
    </View>
  );
}

function ArtBook() {
  return (
    <View style={{ width: 290 }}>
      <View style={[st.card, { padding: 0, overflow: 'hidden' }]}>
        <LinearGradient colors={['#2DD4BF', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 11, letterSpacing: 2 }}>YOUR TOKEN</Text>
          <Text style={{ color: C.white, fontWeight: '900', fontSize: 58, letterSpacing: -1 }}>#12</Text>
        </LinearGradient>
        <View style={st.perf}>
          <View style={[st.notch, { left: -12 }]} />
          <View style={{ flex: 1, borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.line, marginHorizontal: 16 }} />
          <View style={[st.notch, { right: -12 }]} />
        </View>
        <View style={{ padding: 16, paddingTop: 4, gap: 8 }}>
          <Text style={{ color: C.navy900, fontWeight: '800', fontSize: 15 }}>Dr. Ananya Ghosh</Text>
          <Row icon="business-outline" text="Sanjeevani Pharmacy Chamber" />
          <Row icon="time-outline" text="Today · 5:00 PM – 8:00 PM" />
          <View style={[st.pill, { backgroundColor: C.okSoft, alignSelf: 'flex-start', flexDirection: 'row', gap: 4, marginTop: 2 }]}>
            <Ionicons name="checkmark-circle" size={13} color={C.ok} />
            <Text style={{ color: C.ok, fontWeight: '800', fontSize: 11 }}>Confirmed · Pay at clinic</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Row({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={15} color={C.muted} />
      <Text style={{ color: C.muted, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

function ArtLive() {
  return (
    <View style={{ width: 300 }}>
      <Glass style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar name="Ananya Ghosh" size={38} />
            <View>
              <Text style={{ color: C.white, fontWeight: '800', fontSize: 14 }}>Dr. Ananya Ghosh</Text>
              <Text style={{ color: C.onDarkMuted, fontSize: 11.5 }}>General Physician</Text>
            </View>
          </View>
          <View style={[st.pill, { backgroundColor: 'rgba(16,185,129,0.2)', flexDirection: 'row', gap: 5 }]}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#6EE7B7' }} />
            <Text style={{ color: '#A7F3D0', fontWeight: '800', fontSize: 11 }}>Online</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <View style={[st.tile, { backgroundColor: 'rgba(7,29,41,0.45)' }]}>
            <Text style={st.tileLabel}>NOW SERVING</Text>
            <Text style={st.tileValue}>#14</Text>
          </View>
          <View style={[st.tile, { backgroundColor: 'rgba(20,184,166,0.28)', borderColor: 'rgba(94,234,212,0.4)' }]}>
            <Text style={st.tileLabel}>YOUR TOKEN</Text>
            <Text style={st.tileValue}>#18</Text>
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.onDarkMuted, fontSize: 12, fontWeight: '700' }}>4 ahead of you</Text>
            <Text style={{ color: C.white, fontSize: 12, fontWeight: '800' }}>~18 min</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8, overflow: 'hidden' }}>
            <LinearGradient colors={['#5EEAD4', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: '68%', height: '100%', borderRadius: 4 }} />
          </View>
        </View>
      </Glass>
      <View style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginHorizontal: 18 }]}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="notifications" size={17} color={C.tealDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.navy900, fontWeight: '800', fontSize: 13 }}>Your turn is near</Text>
          <Text style={{ color: C.muted, fontSize: 11.5 }}>Leave home now — 3 ahead of you</Text>
        </View>
      </View>
    </View>
  );
}

function ArtSafe() {
  return (
    <View style={{ width: 300, height: 290, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[st.ring, { width: 250, height: 250, borderRadius: 125, opacity: 0.35 }]} />
      <View style={[st.ring, { width: 190, height: 190, borderRadius: 95, opacity: 0.6 }]} />
      <LinearGradient colors={['#2DD4BF', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.finger, SHADOW.glow]}>
        <Ionicons name="finger-print" size={64} color={C.white} />
      </LinearGradient>
      <View style={[st.card, st.floatCard, { top: 18, left: 0 }]}>
        <Ionicons name="document-text" size={16} color={C.tealDark} />
        <Text style={st.floatText}>Prescription</Text>
      </View>
      <View style={[st.card, st.floatCard, { bottom: 26, right: 0 }]}>
        <Ionicons name="flask" size={16} color={C.tealDark} />
        <Text style={st.floatText}>Blood report</Text>
      </View>
      <View style={[st.card, st.floatCard, { bottom: 8, left: 16 }]}>
        <Ionicons name="lock-closed" size={15} color={C.ok} />
        <Text style={st.floatText}>Only you</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  skip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  title: { color: C.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, lineHeight: 34 },
  body: { color: C.onDarkMuted, fontSize: 15.5, lineHeight: 23, marginTop: 10 },
  dots: { flexDirection: 'row', gap: 7, marginBottom: 22, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4, backgroundColor: C.tealGlow },
  secondary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.06)' },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 14, ...SHADOW.raised },
  glass: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 22 },
  pill: { backgroundColor: C.tealSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignItems: 'center' },
  perf: { flexDirection: 'row', alignItems: 'center', height: 24 },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: C.navy800 },
  tile: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tileLabel: { color: C.onDarkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  tileValue: { color: C.white, fontSize: 34, fontWeight: '900', marginTop: 2 },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: C.tealGlow },
  finger: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  floatCard: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 12 },
  floatText: { color: C.navy900, fontWeight: '800', fontSize: 12.5 },
});
