import React from 'react';


export interface FuelSyncLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  variant?: 'brand' | 'mono' | 'compact';
}

/* ---------------- MAIN COMPONENT ---------------- */

const FuelSyncLogo: React.FC<FuelSyncLogoProps> = ({
  size = 40,
  className = "",
  showText = false,
  variant = 'brand'
}) => {
  const textClass = variant === 'brand'
    ? 'text-xl font-bold bg-gradient-to-r from-blue-600 via-blue-700 to-orange-500 bg-clip-text text-transparent'
    : 'text-xl font-bold text-current';
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className="inline-flex items-center justify-center rounded-lg shadow-sm
        border border-blue-200/30 bg-gradient-to-br from-white to-blue-50/50"
        style={{ width: size, height: size }}
        aria-label="FuelSync Logo"
      >
        <img
          src="/logo.jpeg"
          alt="FuelSync Logo"
          className="w-full h-full object-contain"
          style={{ width: size, height: size }}
        />
      </span>

      {showText && (
        <div className="flex flex-col">
          <span className={textClass}>
            FuelSync
          </span>
          <span className="text-xs text-muted-foreground -mt-1 font-medium">
            Smart Station Management
          </span>
        </div>
      )}
    </div>
  );
};

export default FuelSyncLogo;