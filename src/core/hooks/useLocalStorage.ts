/**
 * useLocalStorage Hook
 * 
 * Custom hook for managing localStorage with React state synchronization.
 * Handles JSON serialization/deserialization and cross-tab synchronization.
 * 
 * @module core/hooks/useLocalStorage
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================
// TYPES
// ============================================

type SetValue<T> = T | ((prevValue: T) => T);

interface UseLocalStorageOptions<T> {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
  syncAcrossTabs?: boolean;
}

interface UseLocalStorageReturn<T> {
  value: T;
  setValue: (value: SetValue<T>) => void;
  removeValue: () => void;
  isLoading: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const defaultSerializer = <T>(value: T): string => {
  try {
    return JSON.stringify(value);
  } catch {
    console.warn('Failed to serialize value for localStorage');
    return String(value);
  }
};

const defaultDeserializer = <T>(value: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
};

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): UseLocalStorageReturn<T> {
  const {
    serializer = defaultSerializer,
    deserializer = defaultDeserializer,
    syncAcrossTabs = true,
  } = options;

  const [isLoading, setIsLoading] = useState(true);

  // Get stored value or use initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        return deserializer(item);
      }
      return initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Set loading to false after initial read
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Set value in state and localStorage
  const setValue = useCallback(
    (value: SetValue<T>) => {
      try {
        // Allow value to be a function for same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        
        setStoredValue(valueToStore);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, serializer(valueToStore));
          
          // Dispatch custom event for same-tab synchronization
          window.dispatchEvent(
            new CustomEvent('local-storage', {
              detail: { key, value: valueToStore },
            })
          );
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serializer, storedValue]
  );

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
        
        // Dispatch custom event for same-tab synchronization
        window.dispatchEvent(
          new CustomEvent('local-storage', {
            detail: { key, value: null },
          })
        );
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Sync across tabs
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== key) return;

      if (event.newValue === null) {
        setStoredValue(initialValue);
      } else {
        try {
          setStoredValue(deserializer(event.newValue));
        } catch {
          setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue, deserializer, syncAcrossTabs]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    isLoading,
  };
}

// ============================================
// CONVENIENCE HOOKS
// ============================================

/**
 * Hook for storing boolean values in localStorage
 */
export function useLocalStorageBoolean(
  key: string,
  initialValue = false
): UseLocalStorageReturn<boolean> {
  return useLocalStorage(key, initialValue);
}

/**
 * Hook for storing string values in localStorage
 */
export function useLocalStorageString(
  key: string,
  initialValue = ''
): UseLocalStorageReturn<string> {
  return useLocalStorage(key, initialValue, {
    serializer: (value) => value,
    deserializer: (value) => value,
  });
}

/**
 * Hook for storing number values in localStorage
 */
export function useLocalStorageNumber(
  key: string,
  initialValue = 0
): UseLocalStorageReturn<number> {
  return useLocalStorage(key, initialValue, {
    serializer: (value) => String(value),
    deserializer: (value) => Number(value) || initialValue,
  });
}

// ============================================
// SESSION STORAGE VARIANT
// ============================================

export function useSessionStorage<T>(
  key: string,
  initialValue: T
): UseLocalStorageReturn<T> {
  const [isLoading, setIsLoading] = useState(true);

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = sessionStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
      return initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const setValue = useCallback(
    (value: SetValue<T>) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        sessionStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(`Error setting sessionStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    setStoredValue(initialValue);
    sessionStorage.removeItem(key);
  }, [key, initialValue]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    isLoading,
  };
}
