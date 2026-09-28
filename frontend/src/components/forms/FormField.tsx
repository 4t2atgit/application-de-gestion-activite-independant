import type { ReactNode } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  children: ReactNode;
}

export function FormField({ id, label, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-body">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
