
import React from 'react';

export interface FuelSyncLogoProps {
  size?: number;
  className?: string;
  variant?: 'default' | 'alt' | 'brand';
  showText?: boolean;
}

// Enhanced FuelSync Logo with fuel station elements
const FuelSyncLogo: React.FC<FuelSyncLogoProps> = ({
  size = 40,
  className = "",
  variant = 'default',
  showText = false
}) => {
  const logoSize = showText ? size : size;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className="inline-flex items-center justify-center rounded-xl shadow-lg border-2 border-blue-200/50 bg-gradient-to-br from-blue-50 to-orange-50 overflow-hidden"
        style={{ width: logoSize, height: logoSize, minWidth: logoSize, minHeight: logoSize }}
        aria-label="FuelSync Logo"
      >
        {variant === 'brand' ? (
          <svg width={logoSize} height={logoSize} viewBox="0 0 48 48" fill="none" className="block drop-shadow-md" role="img" xmlns="http://www.w3.org/2000/svg">
            {/* Fuel pump station silhouette */}
            <rect x="8" y="32" width="32" height="12" rx="2" fill="url(#brand-bg)" stroke="url(#brand-stroke)" strokeWidth="1"/>
            {/* Fuel nozzles */}
            <rect x="12" y="28" width="3" height="8" rx="1" fill="url(#brand-nozzle)" stroke="url(#brand-nozzle-stroke)" strokeWidth="0.5"/>
            <rect x="18" y="28" width="3" height="8" rx="1" fill="url(#brand-nozzle)" stroke="url(#brand-nozzle-stroke)" strokeWidth="0.5"/>
            <rect x="24" y="28" width="3" height="8" rx="1" fill="url(#brand-nozzle)" stroke="url(#brand-nozzle-stroke)" strokeWidth="0.5"/>
            <rect x="30" y="28" width="3" height="8" rx="1" fill="url(#brand-nozzle)" stroke="url(#brand-nozzle-stroke)" strokeWidth="0.5"/>
            {/* Price display */}
            <rect x="10" y="34" width="8" height="4" rx="1" fill="url(#brand-display)" stroke="url(#brand-display-stroke)" strokeWidth="0.5"/>
            <rect x="20" y="34" width="8" height="4" rx="1" fill="url(#brand-display)" stroke="url(#brand-display-stroke)" strokeWidth="0.5"/>
            <rect x="30" y="34" width="8" height="4" rx="1" fill="url(#brand-display)" stroke="url(#brand-display-stroke)" strokeWidth="0.5"/>
            {/* Sync arrows */}
            <path d="M36 16 L42 10 L38 8 L44 2" stroke="url(#brand-sync)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M12 16 L6 10 L10 8 L4 2" stroke="url(#brand-sync)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            {/* Central fuel drop */}
            <path d="M24 8 C20 14 16 18 16 24 C16 28 20 32 24 30 C28 32 32 28 32 24 C32 18 28 14 24 8 Z" fill="url(#brand-drop)" stroke="url(#brand-drop-stroke)" strokeWidth="1"/>
            <defs>
              <linearGradient id="brand-bg" x1="8" y1="32" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1e40af"/>
                <stop offset="1" stopColor="#1e3a8a"/>
              </linearGradient>
              <linearGradient id="brand-stroke" x1="8" y1="32" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1e3a8a"/>
                <stop offset="1" stopColor="#1e293b"/>
              </linearGradient>
              <linearGradient id="brand-nozzle" x1="12" y1="28" x2="15" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#374151"/>
                <stop offset="1" stopColor="#1f2937"/>
              </linearGradient>
              <linearGradient id="brand-nozzle-stroke" x1="12" y1="28" x2="15" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1f2937"/>
                <stop offset="1" stopColor="#111827"/>
              </linearGradient>
              <linearGradient id="brand-display" x1="10" y1="34" x2="18" y2="38" gradientUnits="userSpaceOnUse">
                <stop stopColor="#065f46"/>
                <stop offset="1" stopColor="#064e3b"/>
              </linearGradient>
              <linearGradient id="brand-display-stroke" x1="10" y1="34" x2="18" y2="38" gradientUnits="userSpaceOnUse">
                <stop stopColor="#064e3b"/>
                <stop offset="1" stopColor="#022c22"/>
              </linearGradient>
              <linearGradient id="brand-sync" x1="36" y1="16" x2="44" y2="2" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f59e0b"/>
                <stop offset="1" stopColor="#d97706"/>
              </linearGradient>
              <linearGradient id="brand-drop" x1="16" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6"/>
                <stop offset="1" stopColor="#1d4ed8"/>
              </linearGradient>
              <linearGradient id="brand-drop-stroke" x1="16" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1e40af"/>
                <stop offset="1" stopColor="#1e3a8a"/>
              </linearGradient>
            </defs>
          </svg>
        ) : variant === 'alt' ? (
          <svg width={logoSize} height={logoSize} viewBox="0 0 40 40" fill="none" className="block drop-shadow-sm" role="img" xmlns="http://www.w3.org/2000/svg">
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
            width={logoSize}
            height={logoSize}
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
      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
            FuelSync
          </span>
          <span className="text-xs text-muted-foreground -mt-1">
            Station Management
          </span>
        </div>
      )}
    </div>
  );
};

export default FuelSyncLogo;
