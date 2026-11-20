import type { QueueBookingView } from '@okidoc/shared';
import { Linking, View } from 'react-native';
import { Badge, Button, Row, Sheet, statusTone, T } from './ui';
import { useT } from '@/lib/i18n';
import { sittingLabel } from '@/lib/format';
import { C } from '@/lib/theme';

type Action = 'PRESENT' | 'LATE' | 'SKIP' | 'RECALL' | 'CALL' | 'COMPLETE' | 'NO_SHOW' | 'UNDO_NO_SHOW' | 'PAID_AT_CLINIC' | 'CANCEL' | 'MOVE_NEXT';

/** Actions offered for a booking in its current state (CLN-11, CLN-26, PAY-09). */
export function actionsFor(b: QueueBookingView): Action[] {
  switch (b.status) {
    case 'BOOKED':
      return ['PRESENT', 'CALL', 'LATE', 'MOVE_NEXT', 'NO_SHOW', 'CANCEL'];
    case 'PRESENT':
      return ['CALL', 'SKIP', 'CANCEL'];
    case 'LATE':
      return ['PRESENT', 'RECALL', 'MOVE_NEXT', 'NO_SHOW', 'CANCEL'];
    case 'SKIPPED':
      return ['RECALL', 'CALL', 'MOVE_NEXT', 'CANCEL'];
    case 'IN_CONSULTATION':
      return ['COMPLETE', 'SKIP'];
    case 'NO_SHOW':
      return ['UNDO_NO_SHOW'];
    default:
      return [];
  }
}

const LABEL: Record<Action, string> = {
  PRESENT: 'Mark present',
  LATE: 'Mark late',
  SKIP: 'Skip / hold',
  RECALL: 'Recall now (next)',
  CALL: 'Call now',
  COMPLETE: 'Complete visit',
  NO_SHOW: 'Mark absent',
  UNDO_NO_SHOW: 'Came after all — undo absent',
  PAID_AT_CLINIC: 'Paid at clinic',
  CANCEL: 'Cancel booking',
  MOVE_NEXT: "Move to doctor's next sitting",
};

/** BR-06a wording: a late patient who arrives rejoins after the clinic's number of patients. */
const labelFor = (a: Action, b: QueueBookingView, rejoinAfter: number) =>
  a === 'PRESENT' && b.status === 'LATE' ? `Arrived — rejoin ${rejoinAfter === 0 ? 'next' : `after ${rejoinAfter}`}` : LABEL[a];

export const whatsapp = (phone: string, text: string) => Linking.openURL(`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`);

export function BookingActionSheet({
  booking,
  onClose,
  onAction,
  clinicName,
  rejoinAfter = 2,
}: {
  booking: QueueBookingView | null;
  onClose: () => void;
  onAction: (a: Action, paidVia?: string) => void;
  clinicName: string;
  rejoinAfter?: number;
}) {
  const t = useT();
  if (!booking) return null;
  const acts = actionsFor(booking);
  const canMarkPaid = booking.paymentMode !== 'ONLINE_FULL' && !booking.paidAtClinic && ['IN_CONSULTATION', 'SERVED', 'PRESENT'].includes(booking.status);
  return (
    <Sheet visible onClose={onClose} title={`#${booking.tokenNo} · ${booking.patientName}`}>
      <Row style={{ marginBottom: 12 }}>
        <Badge text={t(`status.${booking.status}` as never)} tone={statusTone(booking.status)} />
        <Badge text={booking.source.toLowerCase().replace('_', '-')} tone="muted" />
        {booking.paidAtClinic && <Badge text="paid" tone="ok" />}
        {booking.paymentMode === 'ONLINE_FULL' && <Badge text="prepaid online" tone="info" />}
      </Row>
      {!!booking.checkInAt && ['LATE', 'BOOKED'].includes(booking.status) && (
        <T variant="small" style={{ marginBottom: 10, color: C.tealDark, fontWeight: '700' }}>
          Says they are here (tapped “I’m here” in the app). Check and tap Arrived.
        </T>
      )}
      {booking.status === 'PRESENT' && !!booking.recalledAt && (
        <T variant="small" style={{ marginBottom: 10, color: C.warn, fontWeight: '700' }}>
          Came back after missing their turn — called {booking.rejoinAfter ? `after ${booking.rejoinAfter} more patient${booking.rejoinAfter > 1 ? 's' : ''}` : 'next'}.
        </T>
      )}
      {!!booking.movedFrom && (
        <T variant="small" style={{ marginBottom: 10, color: C.muted }}>
          Moved here from the {sittingLabel(booking.movedFrom)} sitting.
        </T>
      )}
      <View style={{ gap: 8 }}>
        {acts.map((a) => (
          <Button key={a} title={labelFor(a, booking, rejoinAfter)} tone={a === 'CANCEL' || a === 'NO_SHOW' ? 'outline' : a === 'CALL' || a === 'COMPLETE' ? 'primary' : 'soft'} onPress={() => onAction(a)} />
        ))}
        {canMarkPaid && (
          <Row>
            <Button style={{ flex: 1 }} tone="soft" title="Paid · Cash" onPress={() => onAction('PAID_AT_CLINIC', 'CASH')} />
            <Button style={{ flex: 1 }} tone="soft" title="Paid · UPI" onPress={() => onAction('PAID_AT_CLINIC', 'UPI')} />
          </Row>
        )}
        {!!booking.phone && (
          <Row>
            <Button style={{ flex: 1 }} tone="outline" icon="call-outline" title="Call" onPress={() => Linking.openURL(`tel:+91${booking.phone}`)} />
            <Button style={{ flex: 1 }} tone="outline" icon="logo-whatsapp" title="WhatsApp" onPress={() => whatsapp(booking.phone!, `Hello ${booking.patientName}, this is ${clinicName}. Your token #${booking.tokenNo} is coming up.`)} />
          </Row>
        )}
        {!acts.length && !canMarkPaid && <T variant="muted">No actions for this booking.</T>}
      </View>
    </Sheet>
  );
}
