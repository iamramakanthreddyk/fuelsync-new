/**
 * usePagination Hook
 * 
 * Custom hook for managing pagination state and logic.
 * Supports various pagination patterns including offset-based and cursor-based.
 * 
 * @module core/hooks/usePagination
 */

import { useState, useCallback, useMemo } from 'react';
import { UI } from '../constants/app.constants';

// ============================================
// TYPES
// ============================================

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startItem: number;
  endItem: number;
}

export interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  total?: number;
  siblingCount?: number;
}

export interface UsePaginationReturn {
  // State
  page: number;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
  
  // Meta information
  meta: PaginationMeta;
  
  // Actions
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setTotal: (total: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  reset: () => void;
  
  // Helpers
  canGoNext: boolean;
  canGoPrevious: boolean;
  pageNumbers: (number | 'ellipsis')[];
  
  // Query params
  queryParams: { page: number; limit: number; offset: number };
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    initialLimit = UI.DEFAULT_PAGE_SIZE,
    total: initialTotal = 0,
    siblingCount = 1,
  } = options;

  const [page, setPageState] = useState(initialPage);
  const [limit, setLimitState] = useState(initialLimit);
  const [total, setTotalState] = useState(initialTotal);

  // Calculate derived values
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [total, limit]);

  const offset = useMemo(() => {
    return (page - 1) * limit;
  }, [page, limit]);

  const canGoNext = page < totalPages;
  const canGoPrevious = page > 1;

  // Meta information
  const meta: PaginationMeta = useMemo(() => {
    const startItem = total === 0 ? 0 : offset + 1;
    const endItem = Math.min(offset + limit, total);

    return {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: canGoNext,
      hasPreviousPage: canGoPrevious,
      startItem,
      endItem,
    };
  }, [page, totalPages, total, limit, offset, canGoNext, canGoPrevious]);

  // Generate page numbers with ellipsis
  const pageNumbers = useMemo((): (number | 'ellipsis')[] => {
    const totalPageNumbers = siblingCount * 2 + 5; // siblings + first + last + current + 2 ellipsis

    if (totalPages <= totalPageNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(page - siblingCount, 1);
    const rightSiblingIndex = Math.min(page + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, 'ellipsis', totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1
      );
      return [1, 'ellipsis', ...rightRange];
    }

    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );
    return [1, 'ellipsis', ...middleRange, 'ellipsis', totalPages];
  }, [page, totalPages, siblingCount]);

  // Actions
  const setPage = useCallback((newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, totalPages));
    setPageState(clampedPage);
  }, [totalPages]);

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(newLimit);
    // Reset to page 1 when limit changes
    setPageState(1);
  }, []);

  const setTotal = useCallback((newTotal: number) => {
    setTotalState(newTotal);
    // Adjust current page if it's now beyond total pages
    const newTotalPages = Math.max(1, Math.ceil(newTotal / limit));
    if (page > newTotalPages) {
      setPageState(newTotalPages);
    }
  }, [limit, page]);

  const nextPage = useCallback(() => {
    if (canGoNext) {
      setPageState(prev => prev + 1);
    }
  }, [canGoNext]);

  const previousPage = useCallback(() => {
    if (canGoPrevious) {
      setPageState(prev => prev - 1);
    }
  }, [canGoPrevious]);

  const firstPage = useCallback(() => {
    setPageState(1);
  }, []);

  const lastPage = useCallback(() => {
    setPageState(totalPages);
  }, [totalPages]);

  const reset = useCallback(() => {
    setPageState(initialPage);
    setLimitState(initialLimit);
    setTotalState(initialTotal);
  }, [initialPage, initialLimit, initialTotal]);

  // Query params for API calls
  const queryParams = useMemo(() => ({
    page,
    limit,
    offset,
  }), [page, limit, offset]);

  return {
    // State
    page,
    limit,
    offset,
    total,
    totalPages,
    
    // Meta
    meta,
    
    // Actions
    setPage,
    setLimit,
    setTotal,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    reset,
    
    // Helpers
    canGoNext,
    canGoPrevious,
    pageNumbers,
    
    // Query params
    queryParams,
  };
}

// ============================================
// INFINITE SCROLL HOOK
// ============================================

export interface UseInfiniteScrollOptions {
  initialLimit?: number;
  threshold?: number;
}

export interface UseInfiniteScrollReturn {
  items: number;
  limit: number;
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  reset: () => void;
  setHasMore: (hasMore: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  incrementItems: (count: number) => void;
}

export function useInfiniteScroll(
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const { initialLimit = UI.DEFAULT_PAGE_SIZE } = options;

  const [items, setItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [isLoading, hasMore]);

  const reset = useCallback(() => {
    setItems(0);
    setHasMore(true);
    setIsLoading(false);
    setPage(1);
  }, []);

  const incrementItems = useCallback((count: number) => {
    setItems(prev => prev + count);
  }, []);

  return {
    items,
    limit: initialLimit,
    hasMore,
    isLoading,
    loadMore,
    reset,
    setHasMore,
    setIsLoading,
    incrementItems,
  };
}

// ============================================
// CURSOR-BASED PAGINATION HOOK
// ============================================

export interface UseCursorPaginationOptions<TCursor = string> {
  initialLimit?: number;
}

export interface UseCursorPaginationReturn<TCursor = string> {
  cursor: TCursor | null;
  nextCursor: TCursor | null;
  limit: number;
  hasMore: boolean;
  isLoading: boolean;
  setNextCursor: (cursor: TCursor | null) => void;
  loadMore: () => void;
  reset: () => void;
  setIsLoading: (isLoading: boolean) => void;
}

export function useCursorPagination<TCursor = string>(
  options: UseCursorPaginationOptions<TCursor> = {}
): UseCursorPaginationReturn<TCursor> {
  const { initialLimit = UI.DEFAULT_PAGE_SIZE } = options;

  const [cursor, setCursor] = useState<TCursor | null>(null);
  const [nextCursor, setNextCursor] = useState<TCursor | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasMore = nextCursor !== null;

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCursor(nextCursor);
    }
  }, [isLoading, hasMore, nextCursor]);

  const reset = useCallback(() => {
    setCursor(null);
    setNextCursor(null);
    setIsLoading(false);
  }, []);

  return {
    cursor,
    nextCursor,
    limit: initialLimit,
    hasMore,
    isLoading,
    setNextCursor,
    loadMore,
    reset,
    setIsLoading,
  };
}
