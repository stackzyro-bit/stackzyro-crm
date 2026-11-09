import type { ReactNode } from "react";
import { cn } from "../../lib/format";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  width?: string;
}

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: Parameters<typeof EmptyState>[0]["icon"];
  onRowClick?: (row: T) => void;
  skeletonRows?: number;
  minWidth?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Records will appear here once they are added.",
  emptyAction,
  emptyIcon,
  onRowClick,
  skeletonRows = 6,
  minWidth = "760px",
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="bg-[#fbf9ff]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ width: column.width }}
                className={cn(
                  "whitespace-nowrap border-b border-line px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-400",
                  ALIGN[column.align ?? "left"],
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-line last:border-0">
                  {columns.map((column, columnIndex) => (
                    <td key={column.key} className="px-4 py-3.5">
                      <Skeleton
                        className={cn(
                          "h-3.5",
                          columnIndex === 0 ? "w-24" : columnIndex === 1 ? "w-36" : "w-16"
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-line transition-colors last:border-0",
                    onRowClick ? "cursor-pointer hover:bg-brand-50/40" : "hover:bg-[#fcfbfe]"
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-4 py-3 align-middle text-ink-700",
                        ALIGN[column.align ?? "left"],
                        column.className
                      )}
                    >
                      {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                  action={emptyAction}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
  className,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const windowStart = Math.max(1, Math.min(page - 2, Math.max(1, pages - 4)));
  const windowEnd = Math.min(pages, windowStart + 4);
  const pageNumbers = Array.from({ length: Math.max(0, windowEnd - windowStart + 1) }, (_, index) => windowStart + index);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3",
        className
      )}
    >
      <p className="text-[11.5px] text-ink-400">
        {total === 0 ? "No records" : `Showing ${first}–${last} of ${total}`}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink-600 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:text-ink-300"
          >
            Previous
          </button>
          {pageNumbers.map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => onPage(number)}
              aria-current={number === page ? "page" : undefined}
              className={cn(
                "h-7 min-w-7 rounded-md px-1.5 text-[11.5px] font-medium transition-colors",
                number === page
                  ? "bg-brand-600 text-white"
                  : "text-ink-500 hover:bg-brand-50 hover:text-brand-700"
              )}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pages}
            className="rounded-md border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink-600 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:text-ink-300"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
