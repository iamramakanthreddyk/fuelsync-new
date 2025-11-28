/**
 * DataTable Component
 * 
 * A flexible, feature-rich data table component with sorting, pagination,
 * and selection support.
 * 
 * @module core/components/ui/DataTable
 */

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

// ============================================
// TYPES
// ============================================

export interface DataTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Display header */
  header: string;
  /** Access data from row */
  accessor?: keyof T | ((row: T) => React.ReactNode);
  /** Custom cell renderer */
  cell?: (row: T, index: number) => React.ReactNode;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Column width */
  width?: string | number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Additional header class */
  headerClassName?: string;
  /** Additional cell class */
  cellClassName?: string;
}

export interface DataTableProps<T> {
  /** Data to display */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Unique key for each row */
  rowKey: keyof T | ((row: T) => string);
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state action */
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  /** Enable row selection */
  selectable?: boolean;
  /** Selected row keys */
  selectedKeys?: Set<string>;
  /** Selection change handler */
  onSelectionChange?: (selectedKeys: Set<string>) => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Pagination */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
  };
  /** Sort state */
  sortState?: {
    key: string;
    direction: 'asc' | 'desc';
  };
  /** Sort change handler */
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
  /** Additional table class */
  className?: string;
  /** Striped rows */
  striped?: boolean;
  /** Hoverable rows */
  hoverable?: boolean;
  /** Compact mode */
  compact?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyMessage = 'No data available',
  emptyAction,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
  onRowClick,
  pagination,
  sortState,
  onSortChange,
  className,
  striped = false,
  hoverable = true,
  compact = false,
}: DataTableProps<T>): React.ReactElement {
  const [internalSort, setInternalSort] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const currentSort = sortState || internalSort;

  const getRowKey = (row: T): string => {
    if (typeof rowKey === 'function') {
      return rowKey(row);
    }
    return String(row[rowKey]);
  };

  const getCellValue = (row: T, column: DataTableColumn<T>): React.ReactNode => {
    if (column.cell) {
      return column.cell(row, data.indexOf(row));
    }
    if (column.accessor) {
      if (typeof column.accessor === 'function') {
        return column.accessor(row);
      }
      return row[column.accessor] as React.ReactNode;
    }
    return null;
  };

  const handleSort = (key: string) => {
    const newDirection =
      currentSort?.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc';
    
    if (onSortChange) {
      onSortChange(key, newDirection);
    } else {
      setInternalSort({ key, direction: newDirection });
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    const allKeys = new Set(data.map(getRowKey));
    const allSelected = data.every((row) => selectedKeys.has(getRowKey(row)));

    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(allKeys);
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedKeys);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    onSelectionChange(newSelection);
  };

  const allSelected = data.length > 0 && data.every((row) => selectedKeys.has(getRowKey(row)));
  const someSelected = data.some((row) => selectedKeys.has(getRowKey(row)));

  // Sort data if using internal sorting
  const sortedData = useMemo(() => {
    if (!internalSort || onSortChange) return data;

    const column = columns.find((c) => c.key === internalSort.key);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const aValue = column.accessor
        ? typeof column.accessor === 'function'
          ? column.accessor(a)
          : a[column.accessor]
        : null;
      const bValue = column.accessor
        ? typeof column.accessor === 'function'
          ? column.accessor(b)
          : b[column.accessor]
        : null;

      if (aValue === null || bValue === null) return 0;
      if (aValue < bValue) return internalSort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return internalSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, internalSort, columns, onSortChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        type="empty"
        title={emptyMessage}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {selectable && (
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = someSelected && !allSelected;
                        }
                      }}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      'px-4 font-medium text-muted-foreground',
                      compact ? 'py-2' : 'py-3',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.sortable && 'cursor-pointer select-none hover:text-foreground',
                      column.headerClassName
                    )}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className={cn(
                      'flex items-center gap-1',
                      column.align === 'center' && 'justify-center',
                      column.align === 'right' && 'justify-end'
                    )}>
                      {column.header}
                      {column.sortable && (
                        <span className="ml-1">
                          {currentSort?.key === column.key ? (
                            currentSort.direction === 'asc' ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => {
                const key = getRowKey(row);
                const isSelected = selectedKeys.has(key);

                return (
                  <tr
                    key={key}
                    className={cn(
                      'border-t',
                      striped && index % 2 === 1 && 'bg-muted/30',
                      hoverable && 'hover:bg-muted/50',
                      isSelected && 'bg-primary/5',
                      onRowClick && 'cursor-pointer'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectRow(key);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4',
                          compact ? 'py-2' : 'py-3',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                          column.cellClassName
                        )}
                      >
                        {getCellValue(row, column)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && (
        <TablePagination {...pagination} />
      )}
    </div>
  );
}

// ============================================
// PAGINATION COMPONENT
// ============================================

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}) => {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div className="text-muted-foreground">
        Showing {startItem} to {endItem} of {total} results
      </div>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded border bg-background px-2"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <span className="px-3 text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
