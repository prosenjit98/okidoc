import { useLocalSearchParams } from '@/lib/nav';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Badge, Button, Card, Chip, Empty, Input, ListItem, Screen, Section, Sheet, statusTone, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/theme';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  updatedAt: string;
  messages: { id: string; body: string; fromStaff: boolean; createdAt: string }[];
}
const CATEGORIES = ['BOOKING', 'CLINIC', 'ACCOUNT', 'PAYMENT', 'BLOCK_APPEAL', 'OTHER'] as const;

/** Contact & support, including missed-visit block appeals (BR-07c). */
export default function Support() {
  const t = useT();
  const { clinicId, appRole } = useAuth();
  const params = useLocalSearchParams<{ category?: string }>();
  const contact = useApi<{ email: string; phone: string; hours: string; grievanceOfficer: { email: string } }>(['contact'], '/support/contact');
  const tickets = useApi<Ticket[]>(['tickets'], '/support/tickets');
  const [open, setOpen] = useState(!!params.category);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>((params.category as (typeof CATEGORIES)[number]) ?? 'OTHER');
  const [subject, setSubject] = useState(params.category === 'BLOCK_APPEAL' ? 'Appeal: online booking block' : '');
  const [body, setBody] = useState('');
  const [view, setView] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');

  const create = useAction(() => api('/support/tickets', { body: { subject, body, category, clinicId: appRole === 'clinic' ? clinicId ?? undefined : undefined } }), {
    invalidate: [['tickets']],
    onSuccess: () => {
      setOpen(false);
      setSubject('');
      setBody('');
    },
  });
  const send = useAction(() => api<Ticket>(`/support/tickets/${view!.id}/reply`, { body: { body: reply } }), {
    invalidate: [['tickets']],
    onSuccess: (r) => {
      setView(r);
      setReply('');
    },
  });

  return (
    <Screen back tabs={false} title={t('account.help')} right={<Button small title="New" icon="add" onPress={() => setOpen(true)} />}>
      {contact.data && (
        <Card style={{ paddingVertical: 4 }}>
          <ListItem icon="mail-outline" title={contact.data.email} subtitle={contact.data.hours} onPress={() => Linking.openURL(`mailto:${contact.data!.email}`)} />
          <ListItem icon="call-outline" title={contact.data.phone} onPress={() => Linking.openURL(`tel:${contact.data!.phone.replace(/\s/g, '')}`)} />
          <ListItem icon="shield-outline" title="Grievance officer" subtitle={contact.data.grievanceOfficer.email} onPress={() => Linking.openURL(`mailto:${contact.data!.grievanceOfficer.email}`)} />
        </Card>
      )}
      <Section title="Your requests">
        {!tickets.data?.length ? (
          <Empty icon="chatbubbles-outline" title="No requests yet" action="Contact support" onAction={() => setOpen(true)} />
        ) : (
          tickets.data.map((tk) => (
            <Card key={tk.id} onPress={() => setView(tk)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {tk.subject}
                </T>
                <Badge text={tk.status.toLowerCase()} tone={statusTone(tk.status)} />
              </View>
              <T variant="muted">
                {tk.category.replace('_', ' ').toLowerCase()} · {dateTime(tk.updatedAt)}
              </T>
            </Card>
          ))
        )}
      </Section>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Contact support">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c.replace('_', ' ').toLowerCase()} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <Input label="Subject" value={subject} onChangeText={setSubject} />
        <Input label="Message" value={body} onChangeText={setBody} multiline />
        <Button title="Send" disabled={subject.length < 3 || body.length < 3} loading={create.isPending} onPress={() => create.mutate()} />
      </Sheet>
      <Sheet visible={!!view} onClose={() => setView(null)} title={view?.subject ?? ''}>
        {view?.messages.map((m) => (
          <View key={m.id} style={{ alignSelf: m.fromStaff ? 'flex-start' : 'flex-end', backgroundColor: m.fromStaff ? C.white : C.tealSoft, borderRadius: 14, padding: 10, marginBottom: 8, maxWidth: '90%' }}>
            <T>{m.body}</T>
            <T variant="muted">{m.fromStaff ? 'Okidoc support' : 'You'} · {dateTime(m.createdAt)}</T>
          </View>
        ))}
        <Input value={reply} onChangeText={setReply} placeholder="Reply" multiline />
        <Button title="Send" disabled={!reply.trim()} loading={send.isPending} onPress={() => send.mutate()} />
      </Sheet>
    </Screen>
  );
}
