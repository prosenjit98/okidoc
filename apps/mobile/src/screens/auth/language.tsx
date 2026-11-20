import { LANGUAGE_NAMES, LANGUAGES } from '@okidoc/shared';
import { router } from '@/lib/nav';
import { AuthShell, GlassOption } from '@/components/AuthShell';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

/** AUTH-02 language picker. */
export default function Language() {
  const { lang, setLang, t } = useI18n();
  return (
    <AuthShell back title={t('lang.title')} footer={<Button title={t('common.continue')} onPress={() => router.push('/role')} />}>
      {LANGUAGES.map((l) => (
        <GlassOption key={l} icon="language-outline" title={LANGUAGE_NAMES[l]} desc={l === 'bn' ? 'Bengali' : l === 'hi' ? 'Hindi' : 'English'} selected={lang === l} onPress={() => setLang(l)} />
      ))}
    </AuthShell>
  );
}
