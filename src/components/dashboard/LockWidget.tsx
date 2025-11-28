
import React from "react";

type LockWidgetProps = {
  onClick: () => void;
  children: React.ReactNode;
};

export function LockWidget({ onClick, children }: LockWidgetProps) {
  return (
    <div className="relative cursor-pointer select-none opacity-60 blur-sm" onClick={onClick}>
      {children}
      <div className="absolute inset-0 bg-white/70 dark:bg-black/60 flex flex-col items-center justify-center z-10 rounded-[inherit] backdrop-blur-[2px]">
        <span className="text-xs font-semibold text-yellow-500">
          <span className="flex items-center gap-1">
            <svg width="1em" height="1em" viewBox="0 0 20 20" className="inline align-middle">
              <path fill="#facc15" d="M10 2a5 5 0 0 1 5 5v3h1c.6 0 1 .4 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6c0-.6.4-1 1-1h1V7a5 5 0 0 1 5-5m0 2A3 3 0 0 0 7 7v3h6V7a3 3 0 0 0-3-3m0 8a1 1 0 0 0-.99 1v2.01a1 1 0 1 0 2 0V13A1 1 0 0 0 10 12" />
            </svg>
            Available on Premium – Upgrade to view detailed insights.
          </span>
        </span>
      </div>
    </div>
  );
}

