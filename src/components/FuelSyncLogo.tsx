
import React from 'react';

export interface FuelSyncLogoProps {
  size?: number;
  className?: string;
  variant?: 'default' | 'alt';
}

// Modern minimalist SVG, geometric, bold shapes, blue + orange "sync" droplets
const FuelSyncLogo: React.FC<FuelSyncLogoProps> = ({ size = 34, className = "", variant = 'default' }) => (
  <span
    className={`inline-flex items-center justify-center ${className}`}
    style={{ width: size, height: size, minWidth: size, minHeight: size }}
    aria-label="FuelSync Logo"
  >
    {variant === 'alt' ? (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="block" role="img" xmlns="http://www.w3.org/2000/svg">
        {/* Rounded colored background for contrast */}
        <rect width="40" height="40" rx="8" fill="url(#alt-bg)" />
        <g transform="translate(0,0)">
          <circle cx="20" cy="18" r="8" fill="url(#alt-drop)" />
          <path d="M28 18c0 5-4 9-10 9" stroke="#ffb64d" strokeWidth="2" strokeLinecap="round" />
        </g>
        <defs>
          <linearGradient id="alt-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eef2ff" />
            <stop offset="1" stopColor="#e0f2fe" />
          </linearGradient>
          <linearGradient id="alt-drop" x1="8" y1="8" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4f46e5" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      </svg>
    ) : (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        className="block"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="fs-drop" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3399ff" />
            <stop offset="1" stopColor="#0057b8" />
          </linearGradient>
          <linearGradient id="fs-sync" x1="36" y1="9" x2="19" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffb64d" />
            <stop offset="1" stopColor="#fa541c" />
          </linearGradient>
        </defs>
        {/* Stylized drop */}
        <path
          d="M20 4 C14 15 6 21.5 6 29 C6 36 14 40 20 36 C26 40 34 36 34 29 C34 21.5 26 15 20 4 Z"
          fill="url(#fs-drop)"
          stroke="#1876d1"
          strokeWidth="1.8"
        />
        {/* Abstract sync semi-circle (modern, not literal arrows) */}
        <path
          d="M26 19A6 6 0 1 1 14 19"
          stroke="url(#fs-sync)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Dot for implied sync motion */}
        <circle cx="14" cy="19" r="1.7" fill="url(#fs-sync)" />
      </svg>
    )}
  </span>
);

export default FuelSyncLogo;
