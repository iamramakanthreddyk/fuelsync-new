
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { CheckCircle2, Lock } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-yellow-500" />
            Unlock Premium Insights!
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <PremiumComparisonTable />
          <a
            href="/upgrade"
            className="block w-full bg-yellow-500 hover:bg-yellow-600 text-white text-center mt-4 rounded px-4 py-2 font-medium transition"
          >
            Upgrade to Premium
          </a>
        </div>
        <DialogClose
          asChild
        >
          <button className="absolute top-2 right-2 text-muted-foreground rounded px-2 py-1 hover:bg-muted">
            ×
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function PremiumComparisonTable() {
  return (
    <div className="border rounded-lg p-4 bg-muted">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-sm w-2/3">Feature</span>
        <span className="font-semibold text-sm text-center w-1/6">Free</span>
        <span className="font-semibold text-sm text-center w-1/6">Premium</span>
      </div>
      <div className="flex justify-between items-center py-1 border-b last:border-b-0">
        <span className="text-sm w-2/3">Dashboard Overview</span>
        <span className="text-center w-1/6"><CheckCircle2 className="inline text-green-500" /></span>
        <span className="text-center w-1/6"><CheckCircle2 className="inline text-green-500" /></span>
      </div>
      <div className="flex justify-between items-center py-1 border-b last:border-b-0">
        <span className="text-sm w-2/3">Sales Trend Chart</span>
        <span className="text-center w-1/6 text-muted-foreground opacity-60">—</span>
        <span className="text-center w-1/6"><CheckCircle2 className="inline text-green-500" /></span>
      </div>
      <div className="flex justify-between items-center py-1 border-b last:border-b-0">
        <span className="text-sm w-2/3">Closure Variance Analytics</span>
        <span className="text-center w-1/6 text-muted-foreground opacity-60">—</span>
        <span className="text-center w-1/6"><CheckCircle2 className="inline text-green-500" /></span>
      </div>
      <div className="flex justify-between items-center py-1">
        <span className="text-sm w-2/3">Detailed Reports & Charts</span>
        <span className="text-center w-1/6 text-muted-foreground opacity-60">—</span>
        <span className="text-center w-1/6"><CheckCircle2 className="inline text-green-500" /></span>
      </div>
    </div>
  );
}
