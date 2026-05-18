import React from 'react';
import { cn } from "@/lib/utils";

const RUNNER_SITUATIONS = [
  { value: 'none', label: 'None', icon: '○○○' },
  { value: 'first', label: '1st', icon: '○○●' },
  { value: 'second', label: '2nd', icon: '○●○' },
  { value: 'third', label: '3rd', icon: '●○○' },
  { value: 'first_second', label: '1st & 2nd', icon: '○●●' },
  { value: 'first_third', label: '1st & 3rd', icon: '●○●' },
  { value: 'second_third', label: '2nd & 3rd', icon: '●●○' },
  { value: 'bases_loaded', label: 'Loaded', icon: '●●●' },
];

export default function RBIAndRunnersInput({ rbis, runners, onRBIsChange, onRunnersChange }) {
  return (
    <div className="space-y-4">
      {/* Runners on base */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Runners on Base</p>
        <div className="grid grid-cols-4 gap-1.5">
          {RUNNER_SITUATIONS.map((sit) => (
            <button
              key={sit.value}
              onClick={() => onRunnersChange(sit.value)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs font-medium transition-all",
                runners === sit.value
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              <span className="text-[10px] font-mono tracking-widest leading-tight">{sit.icon}</span>
              <span className="text-[9px] leading-tight">{sit.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* RBIs */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">RBIs</p>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((num) => (
            <button
              key={num}
              onClick={() => onRBIsChange(num)}
              className={cn(
                "w-11 h-11 rounded-full font-bold text-sm transition-all",
                rbis === num
                  ? "bg-accent text-accent-foreground shadow-lg scale-110"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}