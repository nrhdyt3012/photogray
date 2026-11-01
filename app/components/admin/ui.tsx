import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { useEffect } from 'react';
import { cn } from '~/lib/utils';
import { STATUS_LABEL } from '~/lib/format';
import type { TxnStatus } from '~/lib/supabase/types';

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-amber-300 disabled:bg-slate-100';

export function PageHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const TextInput = (p: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cn(inputCls, p.className)} />
);

export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cn(inputCls, p.className)} />
);

type BtnVariant = 'primary' | 'ghost' | 'danger';
export function Btn({
  variant = 'primary',
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...p}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-slate-900 text-white hover:bg-slate-700',
        variant === 'ghost' && 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100',
        variant === 'danger' && 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
        className,
      )}
    />
  );
}

const STATUS_STYLE: Record<TxnStatus, string> = {
  ready: 'bg-amber-100 text-amber-900',
  in_progress: 'bg-sky-100 text-sky-900',
  completed: 'bg-emerald-100 text-emerald-900',
  cancelled: 'bg-slate-200 text-slate-600',
};

export function StatusBadge({ status }: { status: TxnStatus }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Notice({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800',
      )}
    >
      {children}
    </p>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</p>;
}
