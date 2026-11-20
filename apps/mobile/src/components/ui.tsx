import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import LinearGradient from 'react-native-linear-gradient';
import { router } from '@/lib/nav';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { C, GRADIENT, GRADIENT_CTA, R, SHADOW, TAB_BAR_SPACE } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- Screen

/** Decorative glows/rings used on dark gradient surfaces (headers, heroes, auth). */
export function Glow({ size = 220, top, right, left, bottom, opacity = 0.16, ring }: { size?: number; top?: number; right?: number; left?: number; bottom?: number; opacity?: number; ring?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        top,
        right,
        left,
        bottom,
        ...(ring ? { borderWidth: 1.5, borderColor: `rgba(94,234,212,${opacity})` } : { backgroundColor: C.teal, opacity }),
      }}
    />
  );
}

export function Screen({
  title,
  subtitle,
  back,
  right,
  headerExtra,
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  tabs = true,
  contentStyle,
  eyebrow,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  tabs?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Small uppercase line above the title. */
  eyebrow?: string;
}) {
  const insets = useSafeAreaInsets();
  // Scrolling screens shrink above the Android keyboard (edge-to-edge windows are not resized), so forms stay reachable.
  // Non-scrolling screens (e.g. the Assistant chat) handle the keyboard themselves.
  const kb = useAndroidKeyboardHeight(scroll);
  const body = <View style={[{ padding: 16, paddingTop: 18, paddingBottom: kb ? 24 : (tabs ? TAB_BAR_SPACE : 32) + insets.bottom }, contentStyle]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={[...GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Glow size={240} top={-130} right={-70} opacity={0.18} />
        <Glow size={180} top={-40} right={-40} ring opacity={0.25} />
        <View style={s.headerRow}>
          {back && (
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={C.white} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            {!!eyebrow && <Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>}
            {!!title && (
              <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} accessibilityRole="header">
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text style={s.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>
          {right}
        </View>
        {headerExtra}
      </LinearGradient>
      {scroll ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={kb ? { marginBottom: kb } : undefined}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} /> : undefined}
          >
            {body}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1 }}>{body}</View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- basics

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (onPress)
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [s.card, style, pressed && { transform: [{ scale: 0.985 }], opacity: 0.94 }]}
      >
        {children}
      </Pressable>
    );
  return <View style={[s.card, style]}>{children}</View>;
}

export function T({ children, style, variant = 'body', numberOfLines, color }: { children: ReactNode; style?: any; variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'muted'; numberOfLines?: number; color?: string }) {
  return (
    <Text numberOfLines={numberOfLines} style={[s[`t_${variant}`], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function Section({ title, action, onAction, children, subtitle }: { title: string; action?: string; onAction?: () => void; children?: ReactNode; subtitle?: string }) {
  return (
    <View style={{ marginTop: 22 }}>
      <View style={s.sectionRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle} accessibilityRole="header">
            {title}
          </Text>
          {!!subtitle && <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{subtitle}</Text>}
        </View>
        {action && (
          <Pressable onPress={onAction} hitSlop={10} style={({ pressed }) => [s.sectionAction, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <Text style={{ color: C.tealDark, fontWeight: '700', fontSize: 12.5 }}>{action}</Text>
            <Ionicons name="chevron-forward" size={13} color={C.tealDark} />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

type Tone = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'soft';
export function Button({
  title,
  onPress,
  tone = 'primary',
  loading,
  disabled,
  icon,
  iconRight,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  tone?: Tone;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** Icon after the label (e.g. an arrow on "Next"). */
  iconRight?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg: Record<Tone, string> = { primary: C.teal, dark: C.navy900, outline: C.white, ghost: 'transparent', danger: C.bad, soft: C.tealSoft };
  const fg: Record<Tone, string> = { primary: C.white, dark: C.white, outline: C.navy900, ghost: C.tealDark, danger: C.white, soft: C.tealDark };
  const gradient = tone === 'primary' ? GRADIENT_CTA : tone === 'danger' ? (['#F43F5E', '#DC2626'] as const) : null;
  const inner = loading ? (
    <ActivityIndicator color={fg[tone]} />
  ) : (
    <>
      {icon && <Ionicons name={icon} size={small ? 16 : 19} color={fg[tone]} style={{ marginRight: 7 }} />}
      <Text style={[s.btnText, small && { fontSize: 13 }, { color: fg[tone] }]}>{title}</Text>
      {iconRight && <Ionicons name={iconRight} size={small ? 16 : 19} color={fg[tone]} style={{ marginLeft: 7 }} />}
    </>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg[tone], opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        tone === 'outline' && { borderWidth: 1, borderColor: C.line },
        gradient && !disabled && !small && SHADOW.glow,
        style,
      ]}
    >
      {gradient ? (
        <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: small ? 12 : 16 }]} />
      ) : null}
      {inner}
    </Pressable>
  );
}

export function Input({ label, hint, error, style, dark, onFocus, onBlur, ...p }: TextInputProps & { label?: string; hint?: string; error?: string; dark?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && <Text style={[s.label, dark && { color: '#D5E2E7' }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={C.faint}
        {...p}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          s.input,
          focused && { borderColor: C.teal, backgroundColor: C.white, ...(Platform.OS === 'ios' ? { shadowColor: C.teal, shadowOpacity: 0.18, shadowRadius: 8 } : null) },
          p.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 },
          error ? { borderColor: C.bad } : null,
          style,
        ]}
      />
      {!!error && <Text style={{ color: dark ? '#FCA5A5' : C.bad, fontSize: 12, marginTop: 5, fontWeight: '600' }}>{error}</Text>}
      {!error && !!hint && <Text style={{ color: dark ? '#9FB4BD' : C.muted, fontSize: 12, marginTop: 5 }}>{hint}</Text>}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [s.chip, active && s.chipActive, pressed && { opacity: 0.85 }]}
    >
      {icon && <Ionicons name={icon} size={15} color={active ? C.white : C.tealDark} style={{ marginRight: 6 }} />}
      <Text style={{ color: active ? C.white : C.navy900, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const toneMap = {
  ok: [C.okSoft, C.ok],
  warn: [C.warnSoft, C.warn],
  bad: [C.badSoft, C.bad],
  info: [C.tealSoft, C.tealDark],
  muted: ['#F1F5F9', C.muted],
} as const;
export type BadgeTone = keyof typeof toneMap;
export function Badge({ text, tone = 'muted' }: { text: string; tone?: BadgeTone }) {
  return (
    <View style={[s.badge, { backgroundColor: toneMap[tone][0] }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneMap[tone][1], marginRight: 5 }} />
      <Text style={{ color: toneMap[tone][1], fontSize: 11, fontWeight: '800', letterSpacing: 0.2 }}>{text}</Text>
    </View>
  );
}

export const statusTone = (st?: string): BadgeTone =>
  (({
    APPROVED: 'ok', SERVED: 'ok', PRESENT: 'ok', ONLINE: 'ok', PAID: 'ok', ACTIVE: 'ok',
    PENDING: 'warn', PENDING_PAYMENT: 'warn', LATE: 'warn', SKIPPED: 'warn', PAUSED: 'warn', DELAYED: 'warn', DUE: 'warn', OPEN: 'warn',
    REJECTED: 'bad', DECLINED: 'bad', CANCELLED: 'bad', NO_SHOW: 'bad', REMOVED: 'bad',
    IN_CONSULTATION: 'info', BOOKED: 'info', TRIAL: 'info',
  }) as Record<string, BadgeTone>)[st ?? ''] ?? 'muted';

/** Row of stat tiles. */
export function Stats({ items }: { items: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'bad'; icon?: IconName }[] }) {
  return (
    <View style={s.stats}>
      {items.map((it) => {
        const [soft, strong] = it.tone ? toneMap[it.tone] : [C.tealSoft, C.navy900];
        return (
          <View key={it.label} style={s.stat} accessible accessibilityLabel={`${it.label}: ${typeof it.value === 'string' || typeof it.value === 'number' ? it.value : ''}`}>
            {it.icon ? (
              <View style={[s.statIcon, { backgroundColor: soft }]}>
                <Ionicons name={it.icon} size={15} color={it.tone ? strong : C.tealDark} />
              </View>
            ) : (
              <View style={[s.statBar, { backgroundColor: it.tone ? strong : C.teal }]} />
            )}
            <Text style={[s.statValue, it.tone && { color: strong }]} numberOfLines={1} adjustsFontSizeToFit>
              {it.value}
            </Text>
            <Text style={s.statLabel} numberOfLines={2}>
              {it.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Dark hero card ("MY WEEK", "CHAMBER ROSTER"). */
export function Hero({ eyebrow, title, hint, icon = 'calendar-outline' }: { eyebrow: string; title: string; hint?: string; icon?: IconName }) {
  return (
    <LinearGradient colors={[C.navy900, C.navy800, '#0F5560']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <Glow size={160} top={-70} right={-50} opacity={0.2} />
      <View style={{ flex: 1 }}>
        <Row gap={6}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.tealGlow }} />
          <Text style={{ color: C.tealGlow, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }}>{eyebrow.toUpperCase()}</Text>
        </Row>
        <Text style={{ color: C.white, fontSize: 19, fontWeight: '800', marginTop: 6, letterSpacing: -0.2 }}>{title}</Text>
        {!!hint && <Text style={{ color: C.onDarkMuted, fontSize: 13, marginTop: 5, lineHeight: 18 }}>{hint}</Text>}
      </View>
      <View style={s.heroIcon}>
        <Ionicons name={icon} size={24} color={C.white} />
      </View>
    </LinearGradient>
  );
}

/** Friendly empty state: layered icon badge, title, body and an optional action. */
export function Empty({ icon = 'sparkles-outline', title, body, action, onAction }: { icon?: IconName; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={[s.card, { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 22 }]}>
      <View style={s.emptyOuter}>
        <View style={s.emptyInner}>
          <Ionicons name={icon} size={30} color={C.tealDark} />
        </View>
      </View>
      <T variant="h3" style={{ textAlign: 'center', fontSize: 17 }}>
        {title}
      </T>
      {!!body && (
        <T variant="muted" style={{ textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
          {body}
        </T>
      )}
      {action && <Button title={action} onPress={onAction} style={{ marginTop: 18, alignSelf: 'stretch' }} />}
    </View>
  );
}

/** Highlighted call-to-action card (e.g. "Get verified"). */
export function Callout({ tone = 'warn', icon = 'alert-circle', title, body, action, onPress }: { tone?: 'warn' | 'info' | 'bad'; icon?: IconName; title: string; body?: string; action?: string; onPress?: () => void }) {
  const pal = { warn: ['#FFF8E6', '#FDE7B0', '#B45309', '#FEF3C7'], info: [C.tealSoft, '#BEEDE6', C.tealDark, '#D5F3EE'], bad: ['#FFF5F5', '#FECACA', C.bad, C.badSoft] }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.card, { backgroundColor: pal[0], borderColor: pal[1], flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, pressed && { opacity: 0.9 }]}
    >
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: pal[3], alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={21} color={pal[2]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: pal[2], fontWeight: '800', fontSize: 15.5 }}>{title}</Text>
        {!!body && <Text style={{ color: C.navy800, fontSize: 13, lineHeight: 18, marginTop: 3, opacity: 0.85 }}>{body}</Text>}
        {!!action && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
            <Text style={{ color: pal[2], fontWeight: '800', fontSize: 13.5 }}>{action}</Text>
            <Ionicons name="arrow-forward" size={15} color={pal[2]} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function Locked() {
  const t = useT();
  return <Empty icon="lock-closed-outline" title={t('locked.title')} body={t('locked.body')} />;
}

export const Loading = () => (
  <View style={{ padding: 44, alignItems: 'center' }} accessibilityRole="progressbar" accessibilityLabel="Loading">
    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.teal} />
    </View>
  </View>
);

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  if (error instanceof ApiError && error.code === 'FEATURE_LOCKED') return <Locked />;
  return (
    <View style={[s.card, { backgroundColor: '#FFF5F5', borderColor: '#FECACA', flexDirection: 'row', gap: 12 }]} accessibilityRole="alert">
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.badSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cloud-offline-outline" size={20} color={C.bad} />
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ color: '#991B1B', fontWeight: '600' }}>{error instanceof Error ? error.message : t('common.error')}</T>
        {onRetry && <Button title={t('common.retry')} tone="outline" small icon="refresh" onPress={onRetry} style={{ marginTop: 10, alignSelf: 'flex-start' }} />}
      </View>
    </View>
  );
}

/** Segmented control for dark gradient headers. */
export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={s.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segmentItem, on && s.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={{ color: on ? C.navy900 : '#CFE0E5', fontWeight: '800', fontSize: 13.5 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ name, uri, size = 44, square }: { name: string; uri?: string | null; size?: number; square?: boolean }) {
  const radius = square ? size * 0.3 : size / 2;
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: C.tealSoft }} accessibilityIgnoresInvertColors />;
  const ini = name
    .replace(/^Dr\.?\s*/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <LinearGradient colors={['#2DD4BF', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.white, fontWeight: '800', fontSize: size / 2.7 }}>{ini}</Text>
    </LinearGradient>
  );
}

export function ListItem({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [s.listItem, pressed && onPress && { opacity: 0.75 }]}>
      {icon && (
        <View style={[s.listIcon, danger && { backgroundColor: C.badSoft }]}>
          <Ionicons name={icon} size={20} color={danger ? C.bad : C.tealDark} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: danger ? C.bad : C.navy900, fontSize: 15 }}>{title}</Text>
        {!!subtitle && <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{subtitle}</Text>}
      </View>
      {right ??
        (onPress ? (
          <View style={s.chev}>
            <Ionicons name="chevron-forward" size={15} color={C.muted} />
          </View>
        ) : null)}
    </Pressable>
  );
}

export function Toggle({ label, value, onChange, hint, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <View style={[s.listItem, { paddingVertical: 10 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: C.navy900, fontSize: 14.5 }}>{label}</Text>
        {!!hint && <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 2 }}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: C.teal, false: '#CBD5E1' }}
        thumbColor={C.white}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Keyboard height on Android (a Modal's window is not resized for the keyboard, especially edge-to-edge). */
export function useAndroidKeyboardHeight(enabled = true) {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
      setH(0);
    };
  }, [enabled]);
  return h;
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const kb = useAndroidKeyboardHeight(visible);
  // Lift the sheet above the keyboard and shrink its scroll area so the focused field and the action stay visible.
  const maxBody = Math.min(560, windowH - kb - insets.top - 140);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={s.sheetBackdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: kb ? 12 : 20 + insets.bottom, marginBottom: kb }]}>
          <View style={s.sheetHandle} />
          <View style={[s.sectionRow, { marginBottom: 14 }]}>
            <T variant="h2" style={{ flex: 1 }}>
              {title}
            </T>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={s.sheetClose}>
              <Ionicons name="close" size={20} color={C.navy900} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.max(160, maxBody) }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Numeric passcode pad (AUTH-06/07). */
export function PinPad({ length = 4, onComplete, dark, maxLength = 6, allowVariable }: { length?: number; maxLength?: number; allowVariable?: boolean; onComplete: (pin: string) => void; dark?: boolean }) {
  const [pin, setPin] = useState('');
  const fg = dark ? C.white : C.navy900;
  const target = allowVariable ? maxLength : length;
  const press = (d: string) => {
    const next = (pin + d).slice(0, target);
    setPin(next);
    if (next.length === target) {
      onComplete(next);
      setTimeout(() => setPin(''), 150);
    }
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowVariable ? 'ok' : '', '0', 'del'];
  const dots = allowVariable ? Math.max(4, pin.length) : length;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 16, marginVertical: 22 }} accessible accessibilityLabel={`${pin.length} of ${dots} digits entered`}>
        {Array.from({ length: dots }).map((_, i) => {
          const on = i < pin.length;
          return (
            <View
              key={i}
              style={{
                width: on ? 18 : 16,
                height: on ? 18 : 16,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: dark ? C.tealGlow : C.teal,
                backgroundColor: on ? (dark ? C.tealGlow : C.teal) : 'transparent',
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 282, justifyContent: 'center' }}>
        {keys.map((k, i) => (
          <Pressable
            key={i}
            disabled={!k || (k === 'ok' && pin.length < 4)}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? 'Delete digit' : k === 'ok' ? 'Done' : k || undefined}
            accessibilityState={{ disabled: !k || (k === 'ok' && pin.length < 4) }}
            importantForAccessibility={k ? 'yes' : 'no-hide-descendants'}
            onPress={() => {
              if (k === 'del') setPin(pin.slice(0, -1));
              else if (k === 'ok') {
                onComplete(pin);
                setTimeout(() => setPin(''), 150);
              } else press(k);
            }}
            style={({ pressed }) => [
              s.pinKey,
              k && k !== 'del' && k !== 'ok'
                ? { backgroundColor: dark ? (pressed ? 'rgba(94,234,212,0.22)' : 'rgba(255,255,255,0.08)') : pressed ? C.tealSoft : C.white, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.08)' : C.line }
                : { backgroundColor: 'transparent', opacity: pressed ? 0.6 : 1 },
            ]}
          >
            {k === 'del' ? (
              <Ionicons name="backspace-outline" size={26} color={fg} />
            ) : k === 'ok' ? (
              <Ionicons name="checkmark-circle" size={40} color={pin.length >= 4 ? C.tealGlow : 'rgba(148,163,184,0.5)'} />
            ) : (
              <Text style={{ fontSize: 27, fontWeight: '600', color: fg }}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: C.line, marginVertical: 12 }} />;
export const Row = ({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export function KV({ k, v, bold }: { k: string; v: ReactNode; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <T variant="muted">{k}</T>
      <Text style={{ fontWeight: bold ? '800' : '700', color: C.navy900, fontSize: bold ? 16 : 14 }}>{v}</Text>
    </Row>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: C.tealGlow, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 2 },
  title: { color: C.white, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: C.onDarkMuted, fontSize: 13.5, marginTop: 3, lineHeight: 18 },
  card: { backgroundColor: C.white, borderRadius: R.card, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(11,42,58,0.05)', ...SHADOW.card },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.navy900, letterSpacing: -0.2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.tealSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
  t_h1: { fontSize: 26, fontWeight: '800', color: C.navy900, letterSpacing: -0.4 },
  t_h2: { fontSize: 20, fontWeight: '800', color: C.navy900, letterSpacing: -0.3 },
  t_h3: { fontSize: 16, fontWeight: '800', color: C.navy900 },
  t_body: { fontSize: 15, color: C.text, lineHeight: 21 },
  t_small: { fontSize: 12.5, color: C.text },
  t_label: { fontSize: 11.5, fontWeight: '800', color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  t_muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, minHeight: 52, paddingVertical: 14, paddingHorizontal: 20, overflow: 'visible' },
  btnSmall: { borderRadius: 12, minHeight: 36, paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { fontWeight: '800', fontSize: 15.5, letterSpacing: 0.1 },
  label: { fontSize: 12.5, fontWeight: '700', color: C.navy800, marginBottom: 7 },
  input: { backgroundColor: '#F8FBFB', borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, fontSize: 15.5, color: C.text },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: C.teal, borderColor: C.teal, ...SHADOW.glow, elevation: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: C.white, borderRadius: 18, padding: 13, borderWidth: 1, borderColor: 'rgba(11,42,58,0.05)', ...SHADOW.card },
  statBar: { width: 22, height: 4, borderRadius: 2, marginBottom: 10 },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', color: C.navy900, letterSpacing: -0.3 },
  statLabel: { fontSize: 11.5, color: C.muted, marginTop: 2, fontWeight: '600' },
  hero: { borderRadius: R.lg, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12, overflow: 'hidden', ...SHADOW.raised },
  heroIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  emptyOuter: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', ...SHADOW.card },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 4, marginTop: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  segmentActive: { backgroundColor: C.white, ...SHADOW.card },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  listIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center' },
  chev: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(7,29,41,0.55)' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 10 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#D5DEE2', alignSelf: 'center', marginBottom: 14 },
  sheetClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  pinKey: { width: 74, height: 74, margin: 8, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
});
