import React from 'react';
import { cn } from "@/lib/utils";

export default function CountSelector({ balls, strikes, onBallsChange, onStrikesChange }) {
  return (
    <div className="flex gap-6 justify-center">
      {/* Balls */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Balls</span>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((num) => (
            <button
              key={`ball-${num}`}
              onClick={() => onBallsChange(num)}
              className={cn(
                "w-9 h-9 rounded-full font-semibold text-sm transition-all",
                balls === num
                  ? "bg-green-500 text-white shadow-lg scale-110"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
      
      {/* Strikes */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Strikes</span>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((num) => (
            <button
              key={`strike-${num}`}
              onClick={() => onStrikesChange(num)}
              className={cn(
                "w-9 h-9 rounded-full font-semibold text-sm transition-all",
                strikes === num
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