import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import LinearGradient from 'react-native-linear-gradient';
import { router } from '@/lib/nav';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import type { I18nKey } from '@okidoc/shared';
import { Bell } from '@/components/common';
import { Chip, Screen, useAndroidKeyboardHeight } from '@/components/ui';
import { api, errMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { C, GRADIENT_CTA, SHADOW, TAB_BAR_SPACE } from '@/lib/theme';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  specialties?: { id: string; slug: string; name: string }[];
  emergency?: boolean;
}

const SUGGESTIONS: I18nKey[] = ['assistant.s1', 'assistant.s2', 'assistant.s3', 'assistant.s4'];
const DEFAULT_DISCLAIMER = 'Okidoc Assistant is not a doctor and does not give medical advice. For an emergency call 108 or 112.';

/** PAT-15 Assistant: symptom → which doctor to see. Never diagnoses; always shows the disclaimer. */
export default function Assistant() {
  const { t, lang } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const kb = useAndroidKeyboardHeight();

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
  }, [msgs.length, busy, kb]);

  const send = async (raw?: string) => {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content }];
    setMsgs(next);
    setText('');
    setBusy(true);
    try {
      const r = await api<{ reply: string; emergency: boolean; specialties: Msg['specialties']; followUpQuestion: string | null; disclaimer: string }>('/assistant/chat', {
        body: { messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })), language: lang },
      });
      setDisclaimer(r.disclaimer);
      setMsgs([...next, { role: 'assistant', content: [r.reply, r.followUpQuestion].filter(Boolean).join('\n\n'), specialties: r.specialties, emergency: r.emergency }]);
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: errMessage(e) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      eyebrow={t('assistant.eyebrow')}
      title={t('assistant.title')}
      right={<Bell />}
      scroll={false}
      contentStyle={{ flex: 1, paddingTop: 12, paddingBottom: kb ? kb + 10 : TAB_BAR_SPACE - 8 }}
    >
      <View style={st.disclaimer} accessibilityRole="text">
        <Ionicons name="shield-checkmark" size={15} color={C.warn} />
        <Text style={st.disclaimerText} numberOfLines={2}>
          {disclaimer ?? DEFAULT_DISCLAIMER}
        </Text>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!msgs.length ? (
          <View style={{ paddingTop: 18, paddingBottom: 8 }}>
            <View style={{ alignItems: 'center' }}>
              <LinearGradient colors={['#2DD4BF', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.botBig, SHADOW.glow]}>
                <Ionicons name="sparkles" size={34} color={C.white} />
              </LinearGradient>
              <Text style={st.hello}>{t('assistant.hello')}</Text>
              <Text style={st.helloBody}>{t('assistant.helloBody')}</Text>
            </View>
            <Text style={st.tryLabel}>{t('assistant.try').toUpperCase()}</Text>
            <View style={{ gap: 9 }}>
              {SUGGESTIONS.map((k) => (
                <Pressable key={k} onPress={() => send(t(k))} style={({ pressed }) => [st.suggestion, pressed && { backgroundColor: C.tealSoft }]} accessibilityRole="button">
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={C.tealDark} />
                  <Text style={{ flex: 1, color: C.navy900, fontWeight: '600', fontSize: 14.5 }}>{t(k)}</Text>
                  <Ionicons name="arrow-forward" size={16} color={C.faint} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          msgs.map((m, i) =>
            m.role === 'user' ? (
              <View key={i} style={{ alignSelf: 'flex-end', maxWidth: '84%', marginBottom: 12 }}>
                <LinearGradient colors={[...GRADIENT_CTA]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.bubble, st.userBubble]}>
                  <Text style={{ color: C.white, fontSize: 15, lineHeight: 21 }}>{m.content}</Text>
                </LinearGradient>
              </View>
            ) : (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', maxWidth: '92%', marginBottom: 12 }}>
                <BotAvatar />
                <View style={{ flex: 1 }}>
                  {m.emergency && (
                    <View style={st.emergency} accessibilityRole="alert">
                      <Row>
                        <Ionicons name="warning" size={18} color={C.white} />
                        <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>{t('assistant.emergency')}</Text>
                      </Row>
                      <Pressable onPress={() => Linking.openURL('tel:108')} style={st.callBtn} accessibilityRole="button">
                        <Ionicons name="call" size={16} color={C.bad} />
                        <Text style={{ color: C.bad, fontWeight: '800' }}>{t('assistant.call108')}</Text>
                      </Pressable>
                    </View>
                  )}
                  <View style={[st.bubble, st.botBubble]}>
                    <Text style={{ color: C.text, fontSize: 15, lineHeight: 21 }}>{m.content}</Text>
                  </View>
                  {!!m.specialties?.length && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                      {m.specialties.map((s) => (
                        <Chip key={s.id} icon="search" label={t('assistant.findDoctors', { name: s.name })} onPress={() => router.push(`/search?q=${encodeURIComponent(s.name)}`)} />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ),
          )
        )}
        {busy && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
            <BotAvatar />
            <View style={[st.bubble, st.botBubble, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <ActivityIndicator size="small" color={C.teal} />
              <Text style={{ color: C.muted, fontSize: 14 }}>{t('assistant.typing')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={st.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('assistant.placeholder')}
          placeholderTextColor={C.faint}
          style={st.input}
          multiline
          maxLength={500}
          accessibilityLabel={t('assistant.placeholder')}
        />
        <Pressable onPress={() => send()} disabled={!text.trim() || busy} accessibilityRole="button" accessibilityLabel={t('assistant.send')} style={({ pressed }) => [{ opacity: !text.trim() || busy ? 0.45 : pressed ? 0.85 : 1 }]}>
          <LinearGradient colors={[...GRADIENT_CTA]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.send}>
            <Ionicons name="arrow-up" size={22} color={C.white} />
          </LinearGradient>
        </Pressable>
      </View>
    </Screen>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{children}</View>;

function BotAvatar() {
  return (
    <LinearGradient colors={['#2DD4BF', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.bot}>
      <Ionicons name="sparkles" size={14} color={C.white} />
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  disclaimer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF8E6', borderWidth: 1, borderColor: '#FDE7B0', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  disclaimerText: { color: '#92400E', fontSize: 12, flex: 1, lineHeight: 16 },
  botBig: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hello: { color: C.navy900, fontSize: 20, fontWeight: '800', marginTop: 14, textAlign: 'center', letterSpacing: -0.3 },
  helloBody: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center', paddingHorizontal: 10 },
  tryLabel: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 22, marginBottom: 10 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, ...SHADOW.card },
  bubble: { borderRadius: 20, paddingVertical: 11, paddingHorizontal: 14 },
  userBubble: { borderBottomRightRadius: 6 },
  botBubble: { backgroundColor: C.white, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: C.line, ...SHADOW.card },
  bot: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  emergency: { backgroundColor: C.bad, borderRadius: 18, padding: 14, marginBottom: 8, gap: 10 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: C.white, borderRadius: 24, padding: 6, paddingLeft: 16, borderWidth: 1, borderColor: C.line, ...SHADOW.raised },
  input: { flex: 1, fontSize: 15.5, color: C.text, paddingVertical: 10, maxHeight: 110 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
