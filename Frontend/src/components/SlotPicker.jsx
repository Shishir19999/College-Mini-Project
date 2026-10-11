import { useEffect, useState } from 'react';
import { api } from '../api';
import { dayKeyLocal, fmtDayKey, fmtTime } from '../lib/format';

// Picks a date and a free time slot. kind: 'pickup' | 'table'. value: { date, time }.
export default function SlotPicker({ kind, value, onChange, days = 7 }) {
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState('');
  const date = value.date;
  useEffect(() => {
    let dead = false;
    setSlots(null);
    api.get('/slots', { date, kind }).then((r) => { if (!dead) { setSlots(r.slots); setError(''); } }).catch((e) => !dead && setError(e.message));
    return () => { dead = true; };
  }, [date, kind]);
  const dates = Array.from({ length: days }, (_, i) => dayKeyLocal(i));
  return (
    <div className="slot-picker">
      <div className="field">
        <label htmlFor={`slot-date-${kind}`}>Date</label>
        <select className="input" id={`slot-date-${kind}`} value={date} onChange={(e) => onChange({ date: e.target.value, time: '' })}>
          {dates.map((d, i) => <option key={d} value={d}>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDayKey(d)}</option>)}
        </select>
      </div>
      <fieldset className="slots">
        <legend className="label">Time</legend>
        {error && <p className="field-error" role="alert">{error}</p>}
        {!slots && !error && <p className="muted" role="status">Loading times...</p>}
        {slots && !slots.length && <p className="muted">No more times today. Pick another day.</p>}
        <div className="slot-grid">
          {slots?.map((s) => (
            <label key={s.time} className={`slot ${s.free ? '' : 'full'} ${value.time === s.time ? 'on' : ''}`}>
              <input type="radio" name={`slot-${kind}`} value={s.time} checked={value.time === s.time} disabled={!s.free} onChange={() => onChange({ date, time: s.time })} />
              <span>{fmtTime(s.time)}</span><small>{s.free ? `${s.free} free` : 'Full'}</small>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
