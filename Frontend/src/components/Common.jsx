import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { statusLabel, STATUSES } from '../../../shared/rules.js';
import { fmtDateTime } from '../lib/format';

export function Stars({ value = 0, count, size = '' }) {
  const label = count === 0 || !value ? 'No ratings yet' : `Rated ${value} out of 5${count ? `, ${count} ${count === 1 ? 'review' : 'reviews'}` : ''}`;
  return (
    <span className={`stars ${size}`} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? 'on' : ''}><Icon name="star" filled /></span>)}
      {count !== undefined && <span className="stars-n" aria-hidden="true">{value ? value.toFixed(1) : '-'} ({count})</span>}
    </span>
  );
}

export function StarInput({ value, onChange, label = 'Your rating' }) {
  const id = useId();
  return (
    <fieldset className="star-input">
      <legend className="label">{label}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= value ? 'on' : ''}>
          <input type="radio" name={id} value={n} checked={value === n} onChange={() => onChange(n)} />
          <Icon name="star" filled />
          <span className="sr-only">{n} {n === 1 ? 'star' : 'stars'}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Field({ label, error, hint, children, id }) {
  const auto = useId();
  const fid = id || auto;
  const child = children({ id: fid, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${fid}-err` : hint ? `${fid}-hint` : undefined });
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      {child}
      {hint && !error && <p className="muted hint" id={`${fid}-hint`}>{hint}</p>}
      <p className="field-error" id={`${fid}-err`}>{error || ''}</p>
    </div>
  );
}

export function StatusBadge({ status, mode }) {
  return <span className={`status s-${status}`}>{statusLabel(status, mode)}</span>;
}

export function Timeline({ order }) {
  const cancelled = order.status === 'cancelled';
  const reached = Object.fromEntries(order.history.map((h) => [h.status, h]));
  const steps = cancelled ? ['placed', 'cancelled'] : STATUSES;
  const current = order.status;
  return (
    <ol className="timeline" aria-label="Order progress">
      {steps.map((s) => {
        const h = reached[s];
        const state = h ? (s === current ? 'current' : 'done') : 'todo';
        return (
          <li key={s} className={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="dot" aria-hidden="true">{state === 'done' ? <Icon name="check" /> : null}</span>
            <div><strong>{statusLabel(s, order.mode)}</strong><span className="muted">{h ? fmtDateTime(h.at) : 'Waiting'}</span></div>
          </li>
        );
      })}
    </ol>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="state">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && (action.to ? <Link className="btn" to={action.to}>{action.label}</Link> : <button type="button" className="btn btn-ghost" onClick={action.onClick}>{action.label}</button>)}
    </div>
  );
}

export function Loading({ label = 'Loading' }) {
  return <div className="state" role="status"><div className="spinner" aria-hidden="true" /><p>{label}...</p></div>;
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state" role="alert">
      <h2>Something went wrong</h2>
      <p>{message}</p>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

// Native <dialog>: focus trap, Escape and inert background come from the browser.
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">&times;</button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

export function PageHead({ title, children, action }) {
  return (
    <div className="page-head page-head-row">
      <div><h1>{title}</h1>{children && <p>{children}</p>}</div>
      {action}
    </div>
  );
}

// Simple SVG bar chart: values[] with labels[]; the data is also exposed as a table for screen readers.
export function BarChart({ data, valueKey, labelKey, format = (v) => v, title }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const w = 100 / data.length;
  return (
    <figure className="chart">
      <svg viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label={title} className="chart-svg">
        {data.map((d, i) => {
          const h = (d[valueKey] / max) * 40;
          return <rect key={d[labelKey]} x={i * w + w * 0.15} y={44 - h} width={w * 0.7} height={Math.max(h, 0.4)} rx="0.6"><title>{`${d[labelKey]}: ${format(d[valueKey])}`}</title></rect>;
        })}
      </svg>
      <div className="chart-axis" aria-hidden="true"><span>{data[0]?.[labelKey]}</span><span>{data.at(-1)?.[labelKey]}</span></div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>Day</th><th>Value</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d[labelKey]}><td>{d[labelKey]}</td><td>{format(d[valueKey])}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
