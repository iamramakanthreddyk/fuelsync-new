/**
 * ExpenseSimpleFilter Component
 * Global date filter + Search + 1 additional filter (Category or Station)
 * 
 * Uses app-wide date range and adds search + single filter capability
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter } from 'lucide-react';

export interface ExpenseSimpleFilterProps {
  /** Search query (description, amount, category) */
  searchQuery: string;
  onSearchChange: (query: string) => void;
  
  /** Filter type: 'category' or 'station' */
  filterType: 'category' | 'station';
  onFilterTypeChange: (type: 'category' | 'station') => void;
  
  /** Selected filter value */
  selectedFilter: string;
  onFilterChange: (value: string) => void;
  
  /** Filter options based on type */
  categoryOptions?: { value: string; label: string }[];
  stationOptions?: { value: string; label: string }[];
  
  /** Optional className */
  className?: string;
}

export const ExpenseSimpleFilter: React.FC<ExpenseSimpleFilterProps> = ({
  searchQuery,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  selectedFilter,
  onFilterChange,
  categoryOptions = [],
  stationOptions = [],
  className,
}) => {
  const filterOptions = filterType === 'category' ? categoryOptions : stationOptions;

  return (
    <Card className={className || 'border bg-white shadow-sm'}>
      <CardContent className="p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="expense-search" className="text-sm font-medium flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search
            </Label>
            <Input
              id="expense-search"
              type="text"
              placeholder="Description, amount, date..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full py-2"
            />
          </div>

          {/* Filter Type Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter By
            </Label>
            <Select value={filterType} onValueChange={(v) => onFilterTypeChange(v as 'category' | 'station')}>
              <SelectTrigger className="w-full py-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="station">Station</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Value */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {filterType === 'category' ? 'Category' : 'Station'}
            </Label>
            <Select value={selectedFilter || 'all'} onValueChange={(v) => onFilterChange(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-full py-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filterType === 'category' ? 'Categories' : 'Stations'}</SelectItem>
                {filterOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
