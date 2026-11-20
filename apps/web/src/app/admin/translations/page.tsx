'use client';

import { useState } from 'react';
import { Badge, Card, Input, PageHeader, Spinner, Table, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';

/** ADM-11 localization: override any bundled string; the apps pick it up from /i18n/:lang. */
export default function TranslationsPage() {
  const [language, setLanguage] = useState('bn');
  const [q, setQ] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const key = ['admin', 'translations', language];
  const { data } = useApi<any>(key, `/admin/translations?language=${language}`);
  const save = useAction((v: { key: string; value: string }) => api('/admin/translations', { method: 'PUT', body: { language, ...v } }), { invalidate: [key], success: 'Saved' });
  if (!data) return <Spinner />;
  const rows = data.items.filter((i: any) => (!q || i.key.includes(q) || i.en.toLowerCase().includes(q.toLowerCase())) && (!missingOnly || data.missing.includes(i.key)));
  return (
    <>
      <PageHeader title="Translations" subtitle={`${data.missing.length} strings missing in this language.`} />
      <Tabs value={language} onChange={setLanguage} tabs={[{ id: 'bn', label: 'বাংলা' }, { id: 'hi', label: 'हिन्दी' }, { id: 'en', label: 'English' }]} />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input placeholder="Search key or English text" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Missing only
          </label>
        </div>
        <Table
          rows={rows}
          cols={[
            { h: 'Key', c: (i: any) => <span className="font-mono text-xs">{i.key}</span> },
            { h: 'English', c: (i: any) => i.en, className: 'w-1/3' },
            {
              h: language === 'en' ? 'Override' : 'Translation',
              className: 'w-1/3',
              c: (i: any) => (
                <div>
                  <Input defaultValue={i.override ?? i.base ?? ''} placeholder={i.base ?? 'missing'} onBlur={(e) => e.target.value && e.target.value !== (i.override ?? i.base ?? '') && save.mutate({ key: i.key, value: e.target.value })} />
                  {i.override && <Badge tone="warn">admin override</Badge>}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
