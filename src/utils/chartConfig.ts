/**
 * Unified chart configuration
 * Handles all chart colors, themes, and default options
 */

// Chart Colors - Consistent across all visualizations
export const CHART_COLORS = {
  primary: '#3b82f6',      // Blue
  secondary: '#10b981',    // Green
  danger: '#ef4444',       // Red
  warning: '#f59e0b',      // Amber
  info: '#06b6d4',         // Cyan
  success: '#84cc16',      // Lime
  neutral: '#6b7280',      // Gray-500
  light: '#e5e7eb',        // Gray-200
  
  // Extended palette
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#fbbf24',
  purple: '#a855f7',
  pink: '#ec4899',
  indigo: '#6366f1',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  orange: '#f97316'
};

// Chart gradients (if needed)
export const CHART_GRADIENTS = {
  primary: ['rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0.2)'],
  success: ['rgba(16, 185, 129, 0.8)', 'rgba(16, 185, 129, 0.2)'],
  danger: ['rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.2)'],
};

// Recharts' ResponsiveContainer common props
export const RESPONSIVE_CONTAINER_CONFIG = {
  width: '100%',
  height: 300,
};

// Common chart margin configuration
export const CHART_MARGIN = {
  top: 5,
  right: 30,
  left: 0,
  bottom: 5,
};

// Default tooltip style
export const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 12px'
};

/**
 * Build a dynamic chart color based on index
 * @param index - Index in the data series
 * @returns Color string
 */
export const getChartColor = (index: number): string => {
  const colors = Object.values(CHART_COLORS);
  return colors[index % colors.length];
};

/**
 * Get a sequence of colors for multi-series charts
 * @param count - Number of colors needed
 * @returns Array of color strings
 */
export const getChartColorSequence = (count: number): string[] => {
  const colors = Object.values(CHART_COLORS);
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
};

/**
 * Convert hex color to RGB
 * @param hex - Hex color string (e.g., '#3b82f6')
 * @returns RGB string (e.g., 'rgb(59, 130, 246)')
 */
export const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
};

/**
 * Convert hex color to RGBA
 * @param hex - Hex color string
 * @param alpha - Alpha value (0-1)
 * @returns RGBA string
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
};

/**
 * Get status color based on condition
 * @param value - Value to evaluate
 * @param threshold - Threshold for comparison
 * @param options - Options for color mapping
 * @returns Color string
 */
export const getStatusColor = (
  value: number,
  threshold: number,
  options: {
    aboveColor?: string;
    belowColor?: string;
    equalColor?: string;
  } = {}
): string => {
  const {
    aboveColor = CHART_COLORS.success,
    belowColor = CHART_COLORS.danger,
    equalColor = CHART_COLORS.warning
  } = options;

  if (value > threshold) return aboveColor;
  if (value < threshold) return belowColor;
  return equalColor;
};

/**
 * Lighten a color (useful for hover states)
 * @param hex - Hex color string
 * @param percent - Percentage to lighten (0-100)
 * @returns Lightened hex color
 */
export const lightenColor = (hex: string, percent: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};
