
import React from 'react';

export interface FuelSyncLogoProps {
  size?: number;
  className?: string;
}

// Modern minimalist SVG, geometric, bold shapes, blue + orange "sync" droplets
const FuelSyncLogo: React.FC<FuelSyncLogoProps> = ({ size = 40, className = "" }) => (
  <span
    className={`inline-flex items-center justify-center ${className}`}
    style={{ width: size, height: size, minWidth: size, minHeight: size }}
    aria-label="FuelSync Logo"
  >
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
  </span>
);

export default FuelSyncLogo;
