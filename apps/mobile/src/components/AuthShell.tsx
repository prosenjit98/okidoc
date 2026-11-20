import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import LinearGradient from 'react-native-linear-gradient';
import { router } from '@/lib/nav';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/lib/theme';
import { BrandMark } from './Brand';
import { useAndroidKeyboardHeight } from './ui';

/** Dark teal auth background with glowing curves (welcome / role screens). */
export function AuthShell({ children, back, footer, title, subtitle }: { children: ReactNode; back?: boolean; footer?: ReactNode; title?: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  // Android is edge-to-edge, so the window does not resize for the keyboard: shrink the scroll area ourselves
  // so the focused field and the footer button can be scrolled above the keyboard.
  const kb = useAndroidKeyboardHeight();
  return (
    <LinearGradient colors={[C.navy950, '#0A3440', '#0E4A55']} style={{ flex: 1 }}>
      <View style={[s.glow, { top: -120, right: -100 }]} />
      <View style={[s.glow, { bottom: -160, left: -120, opacity: 0.18 }]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={kb ? { marginBottom: kb } : undefined}
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: kb ? 16 : insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {back && (
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} hitSlop={12} style={s.back} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={C.white} />
            </Pressable>
          )}
          {!!title && <Text style={s.title}>{title}</Text>}
          {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          <View style={{ flex: 1 }}>{children}</View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** App tile — the same artwork as the launcher icon. */
export function Logo({ size = 76 }: { size?: number }) {
  return <BrandMark size={size} />;
}

export function GlassOption({ icon, title, desc, selected, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; desc?: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.option, selected && { borderColor: C.tealGlow, backgroundColor: 'rgba(20,184,166,0.18)' }]} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View style={s.optionIcon}>
        <Ionicons name={icon} size={22} color={C.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.white, fontWeight: '700', fontSize: 16 }}>{title}</Text>
        {!!desc && <Text style={{ color: '#B6C7CF', fontSize: 13, marginTop: 2 }}>{desc}</Text>}
      </View>
      <View style={[s.radio, selected && { borderColor: C.tealGlow }]}>{selected && <View style={s.radioDot} />}</View>
    </Pressable>
  );
}

export const authInput = { backgroundColor: 'rgba(255,255,255,0.95)' };

const s = StyleSheet.create({
  glow: { position: 'absolute', width: 380, height: 380, borderRadius: 190, backgroundColor: C.teal, opacity: 0.12 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: C.white, fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#B6C7CF', fontSize: 14, marginTop: 6, marginBottom: 18 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 },
  optionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.tealGlow },
});
