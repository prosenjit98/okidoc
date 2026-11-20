'use client';

import { cx, Field } from '@/components/ui';
import { WEEKDAYS } from '@/lib/format';

export { Button, Card, cx, ErrorBox, Field, Input, PageHeader, Table } from '@/components/ui';

export function WEEKDAYS_FIELD({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <Field label="Days">
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])}
            className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', value.includes(d) ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600')}
          >
            {WEEKDAYS[d]}
          </button>
        ))}
      </div>
    </Field>
  );
}
