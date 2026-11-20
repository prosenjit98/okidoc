import LinearGradient from 'react-native-linear-gradient';
import { ActivityIndicator, Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { C, GRADIENT } from '@/lib/theme';
import { Glow } from './ui';

const MARK = require('../assets/logo-mark.png');

/** The Okidoc app tile (same artwork as the launcher icon, rendered from assets/brand/okidoc-icon.svg). */
export function BrandMark({ size = 76, glow = true, style }: { size?: number; glow?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size * 0.235 },
        glow && { shadowColor: C.teal, shadowOpacity: 0.55, shadowRadius: size * 0.3, shadowOffset: { width: 0, height: size * 0.1 }, elevation: 12, backgroundColor: C.teal },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Okidoc"
    >
      <Image source={MARK} style={{ width: size, height: size, borderRadius: size * 0.235 }} />
    </View>
  );
}

/** "Okidoc" wordmark — teal "Oki" + white/navy "doc". */
export function Wordmark({ size = 40, dark = true }: { size?: number; dark?: boolean }) {
  return (
    <Text style={{ fontSize: size, fontWeight: '900', letterSpacing: -size * 0.03, color: dark ? C.white : C.navy900 }} accessibilityRole="header">
      <Text style={{ color: dark ? C.tealGlow : C.tealDark }}>Oki</Text>doc
    </Text>
  );
}

/**
 * JS launch screen shown while the app restores the session and language. Same navy background and the same
 * centred 124-pt tile as the native splash (android/.../ic_splash_logo.xml, ios LaunchScreen.storyboard), so the
 * hand-off from native to JS is seamless; the wordmark and spinner then fade in underneath.
 */
export function BrandSplash({ message }: { message?: string }) {
  return (
    <LinearGradient colors={[C.navy950, C.navy950]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={[...GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 }} />
      <Glow size={420} top={-160} right={-180} opacity={0.12} />
      <Glow size={360} bottom={-170} left={-150} opacity={0.1} />
      <BrandMark size={124} />
      <View style={{ position: 'absolute', bottom: '22%', alignItems: 'center' }}>
        <Wordmark size={34} />
        <Text style={{ color: C.onDarkMuted, fontSize: 14, marginTop: 6 }}>Know your queue. Skip the wait.</Text>
        <ActivityIndicator color={C.tealGlow} style={{ marginTop: 22 }} />
        {!!message && <Text style={{ color: C.onDarkMuted, fontSize: 12, marginTop: 10 }}>{message}</Text>}
      </View>
    </LinearGradient>
  );
}
