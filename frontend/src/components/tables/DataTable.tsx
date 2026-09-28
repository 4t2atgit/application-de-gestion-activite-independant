import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  items: T[];
  emptyMessage: string;
}

export function DataTable<T>({ columns, items, emptyMessage }: DataTableProps<T>) {
  if (items.length === 0) {
    return <p className="rounded-2xl bg-surface p-6 text-sm text-muted shadow-sm">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
      <table className="min-w-full divide-y divide-subtle text-left text-sm">
        <thead className="bg-surface-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-semibold text-body">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {items.map((item, index) => (
            <tr key={String((item as { id?: string }).id ?? index)} className="align-top">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-body">
                  {column.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
