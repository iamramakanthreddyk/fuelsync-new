/**
 * Station Store - Zustand store for station selection and state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Station, Pump, Nozzle } from '@/types/api';

interface StationState {
  // Selected station
  selectedStationId: string | null;
  selectedStation: Station | null;
  
  // Available stations for the user
  stations: Station[];
  
  // Nested data for selected station
  pumps: Pump[];
  nozzles: Nozzle[];
  
  // Loading states
  isLoading: boolean;
  
  // Actions
  setSelectedStationId: (id: string | null) => void;
  setSelectedStation: (station: Station | null) => void;
  setStations: (stations: Station[]) => void;
  setPumps: (pumps: Pump[]) => void;
  setNozzles: (nozzles: Nozzle[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Helpers
  clearSelection: () => void;
  reset: () => void;
}

const initialState = {
  selectedStationId: null,
  selectedStation: null,
  stations: [],
  pumps: [],
  nozzles: [],
  isLoading: false,
};

export const useStationStore = create<StationState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setSelectedStationId: (id) => {
        const stations = get().stations;
        const station = stations.find(s => s.id === id) || null;
        set({ 
          selectedStationId: id, 
          selectedStation: station,
          // Clear nested data when station changes
          pumps: [],
          nozzles: [],
        });
      },
      
      setSelectedStation: (station) => {
        set({ 
          selectedStation: station,
          selectedStationId: station?.id || null,
        });
      },
      
      setStations: (stations) => {
        const currentId = get().selectedStationId;
        // If current selection is still valid, keep it
        const stillValid = stations.some(s => s.id === currentId);
        
        set({ 
          stations,
          // Auto-select first station if none selected or selection invalid
          selectedStationId: stillValid ? currentId : (stations[0]?.id || null),
          selectedStation: stillValid 
            ? stations.find(s => s.id === currentId) || null 
            : (stations[0] || null),
        });
      },
      
      setPumps: (pumps) => set({ pumps }),
      
      setNozzles: (nozzles) => set({ nozzles }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      clearSelection: () => set({
        selectedStationId: null,
        selectedStation: null,
        pumps: [],
        nozzles: [],
      }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'fuelsync-station',
      partialize: (state) => ({
        selectedStationId: state.selectedStationId,
      }),
    }
  )
);

// Selectors
export const selectStationId = (state: StationState) => state.selectedStationId;
export const selectStation = (state: StationState) => state.selectedStation;
export const selectStations = (state: StationState) => state.stations;
export const selectPumps = (state: StationState) => state.pumps;
export const selectNozzles = (state: StationState) => state.nozzles;
