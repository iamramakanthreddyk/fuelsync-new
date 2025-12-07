
import React from 'react';

export interface FuelSyncLogoProps {
  size?: number;
  className?: string;
  variant?: 'default' | 'alt';
}

// Modern minimalist SVG, geometric, bold shapes, blue + orange "sync" droplets
const FuelSyncLogo: React.FC<FuelSyncLogoProps> = ({ size = 34, className = "", variant = 'default' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-lg shadow-sm border border-border/20 bg-gradient-to-br from-background to-muted/30 ${className}`}
    style={{ width: size, height: size, minWidth: size, minHeight: size }}
    aria-label="FuelSync Logo"
  >
    {variant === 'alt' ? (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="block drop-shadow-sm" role="img" xmlns="http://www.w3.org/2000/svg">
        {/* Enhanced background with better contrast */}
        <rect width="40" height="40" rx="6" fill="url(#alt-bg)" stroke="url(#alt-border)" strokeWidth="0.5" />
        <g transform="translate(0,0)">
          {/* Main fuel drop with enhanced colors */}
          <circle cx="20" cy="18" r="7" fill="url(#alt-drop)" stroke="url(#alt-drop-stroke)" strokeWidth="0.5" />
          {/* Sync arc with brighter colors */}
          <path d="M27 18c0 4.5-3.5 8-8 8" stroke="url(#alt-sync)" strokeWidth="2.5" strokeLinecap="round" />
          {/* Sync dot */}
          <circle cx="27" cy="18" r="1.5" fill="url(#alt-sync)" />
        </g>
        <defs>
          <linearGradient id="alt-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#f8fafc" />
          </linearGradient>
          <linearGradient id="alt-border" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="1" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="alt-drop" x1="8" y1="8" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="alt-drop-stroke" x1="8" y1="8" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1e40af" />
            <stop offset="1" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="alt-sync" x1="27" y1="18" x2="19" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f59e0b" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
        </defs>
      </svg>
    ) : (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className="block drop-shadow-sm"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="fs-drop" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="fs-drop-stroke" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1e40af" />
            <stop offset="1" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="fs-sync" x1="36" y1="9" x2="19" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f59e0b" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
        </defs>
        {/* Enhanced fuel drop with stroke */}
        <path
          d="M20 4 C14 15 6 21.5 6 29 C6 36 14 40 20 36 C26 40 34 36 34 29 C34 21.5 26 15 20 4 Z"
          fill="url(#fs-drop)"
          stroke="url(#fs-drop-stroke)"
          strokeWidth="1"
        />
        {/* Enhanced sync semi-circle */}
        <path
          d="M26 19A6 6 0 1 1 14 19"
          stroke="url(#fs-sync)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Enhanced sync dot */}
        <circle cx="14" cy="19" r="2" fill="url(#fs-sync)" />
      </svg>
    )}
  </span>
);

export default FuelSyncLogo;
