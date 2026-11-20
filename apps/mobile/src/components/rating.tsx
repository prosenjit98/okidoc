import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { Pressable, View } from 'react-native';
import { Row, T } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

/** Tap-to-rate stars (PAT-16). `value` 0 means "not rated yet". */
export function StarPicker({ value, onChange, size = 34, label }: { value: number; onChange: (n: number) => void; size?: number; label: string }) {
  return (
    <Row gap={6} style={{ justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n === value ? 0 : n)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${n} of 5`}
          accessibilityState={{ selected: n <= value }}
        >
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={C.warn} />
        </Pressable>
      ))}
    </Row>
  );
}

/** Read-only stars, e.g. ★★★★☆ in a review row. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <Row gap={1}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={C.warn} />
      ))}
    </Row>
  );
}

/** Average + count line used on clinic and doctor pages. */
export function RatingLine({ avg, count }: { avg?: number | null; count?: number }) {
  const t = useT();
  if (!avg || !count) return <T variant="small" style={{ color: C.muted }}>{t('doctor.notRated')}</T>;
  return (
    <Row gap={6} style={{ alignItems: 'center' }}>
      <Stars value={avg} />
      <T variant="small" style={{ fontWeight: '700' }}>{avg.toFixed(1)}</T>
      <T variant="small" style={{ color: C.muted }}>· {t('clinic.ratingsCount', { count })}</T>
    </Row>
  );
}

/** A list of public reviews (first name only). */
export function ReviewList({ reviews }: { reviews: { rating: number | null; comment?: string | null; by: string }[] }) {
  return (
    <View style={{ gap: 10 }}>
      {reviews.map((r, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Row gap={6} style={{ alignItems: 'center' }}>
            {r.rating ? <Stars value={r.rating} size={12} /> : null}
            <T variant="small" style={{ color: C.muted }}>{r.by}</T>
          </Row>
          {r.comment ? <T variant="small">“{r.comment}”</T> : null}
        </View>
      ))}
    </View>
  );
}
