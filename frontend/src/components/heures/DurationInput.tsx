import { useEffect, useState } from 'react';

const durationTextPattern = /^(0(\.5?)?|1)?$/;

function formatCellText(value: number): string {
  if (value === 1) return '1';
  if (value === 0.5) return '0.5';
  return '';
}

function parseCellText(text: string): number | null {
  if (text === '' || text === '0' || text === '0.') return 0;
  if (text === '0.5') return 0.5;
  if (text === '1') return 1;
  return null;
}

interface DurationInputProps {
  value: number;
  disabled: boolean;
  ariaLabel?: string;
  isIncomplete: boolean;
  isAllowed: (candidate: number) => boolean;
  onCommit: (value: number) => void;
  onInvalid: () => void;
}

/** Cellule de saisie d'une durée (0, 0,5 ou 1 jour) pour un projet et une date donnés. */
export function DurationInput({ value, disabled, ariaLabel, isIncomplete, isAllowed, onCommit, onInvalid }: DurationInputProps) {
  const [text, setText] = useState(() => formatCellText(value));

  useEffect(() => {
    setText(formatCellText(value));
  }, [value]);

  function commit() {
    const parsed = parseCellText(text);
    if (parsed === null || parsed === value) {
      setText(formatCellText(value));
      return;
    }
    if (!isAllowed(parsed)) {
      setText(formatCellText(value));
      onInvalid();
      return;
    }
    onCommit(parsed);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="—"
      className={`w-full rounded-lg border px-1 py-1.5 text-center text-sm ${isIncomplete ? 'border-warning-soft-border bg-warning-soft' : 'border-subtle bg-surface'}`}
      aria-label={ariaLabel}
      value={text}
      disabled={disabled}
      onChange={(event) => {
        if (durationTextPattern.test(event.target.value)) {
          setText(event.target.value);
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
    />
  );
}
