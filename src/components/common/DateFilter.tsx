// One date filter for every page. Values are IST day keys ('yyyy-MM-dd'), so the
// page can pass them straight into a Firestore where('date', ...) query.
// Styled like the existing filter pills on the Orders page.

import { addDays, todayKey } from '../../data/dates';

export interface DateRange {
  from: string; // inclusive 'yyyy-MM-dd'
  to: string;   // inclusive 'yyyy-MM-dd'
}

type Preset = 'yesterday' | 'today' | 'tomorrow' | 'last7' | 'last30' | 'next30' | 'all';

function presetRange(p: Preset): DateRange {
  const t = todayKey();
  switch (p) {
    case 'yesterday': return { from: addDays(t, -1), to: addDays(t, -1) };
    case 'today': return { from: t, to: t };
    case 'tomorrow': return { from: addDays(t, 1), to: addDays(t, 1) };
    case 'last7': return { from: addDays(t, -6), to: addDays(t, 30) }; // Include upcoming week drops
    case 'last30': return { from: addDays(t, -29), to: addDays(t, 30) };
    case 'next30': return { from: t, to: addDays(t, 30) };
    case 'all': return { from: addDays(t, -60), to: addDays(t, 60) };
  }
}

const LABELS: Record<Preset, string> = {
  yesterday: 'Yesterday', today: 'Today', tomorrow: 'Tomorrow', last7: 'Last 7 days', last30: 'Last 30 days', next30: 'Next 30 days', all: 'All Dates',
};

const pill = (active: boolean): React.CSSProperties => ({
  padding: '0.38rem 0.65rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: active ? '#0284C7' : 'var(--bg-main)',
  color: active ? '#FFFFFF' : 'var(--text-main)',
  fontWeight: 700,
  fontSize: '0.78rem',
  cursor: 'pointer',
});

const dateInput = (active: boolean): React.CSSProperties => ({
  padding: '0.35rem 0.55rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: active ? '#ECFDF5' : 'var(--bg-main)',
  color: active ? '#047857' : 'var(--text-main)',
  fontWeight: 700,
  fontSize: '0.78rem',
  outline: 'none',
  cursor: 'pointer',
});

interface DateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Which quick buttons to show. Single-day pages usually omit the multi-day ones. */
  presets?: Preset[];
  /** Show from/to inputs (range) instead of one date input. */
  allowRange?: boolean;
}

export function DateFilter({
  value, onChange, presets = ['yesterday', 'today', 'tomorrow'], allowRange = false,
}: DateFilterProps) {
  const activePreset = presets.find((p) => {
    const r = presetRange(p);
    return r.from === value.from && r.to === value.to;
  });

  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {presets.map((p) => (
        <button key={p} type="button" style={pill(activePreset === p)} onClick={() => onChange(presetRange(p))}>
          {LABELS[p]}
        </button>
      ))}

      {allowRange ? (
        <>
          <input
            type="date"
            aria-label="From date"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to < e.target.value ? e.target.value : value.to })}
            style={dateInput(!activePreset)}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>to</span>
          <input
            type="date"
            aria-label="To date"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ from: value.from > e.target.value ? e.target.value : value.from, to: e.target.value })}
            style={dateInput(!activePreset)}
          />
        </>
      ) : (
        <input
          type="date"
          aria-label="Date"
          value={value.from}
          onChange={(e) => e.target.value && onChange({ from: e.target.value, to: e.target.value })}
          style={dateInput(!activePreset)}
        />
      )}
    </div>
  );
}

export const todayRange = (): DateRange => presetRange('today');
export const lastDaysRange = (days: 7 | 30): DateRange => presetRange(days === 7 ? 'last7' : 'last30');
