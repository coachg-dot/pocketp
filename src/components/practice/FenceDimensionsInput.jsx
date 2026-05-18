import React from 'react';
import { Input } from "@/components/ui/input";

export default function FenceDimensionsInput({ lf, cf, rf, onChange }) {
  const handle = (field) => (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) onChange({ lf, cf, rf, [field]: val });
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { key: 'lf', label: 'LF', val: lf },
        { key: 'cf', label: 'CF', val: cf },
        { key: 'rf', label: 'RF', val: rf },
      ].map(({ key, label, val }) => (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground text-center">{label}</label>
          <div className="relative">
            <Input
              type="number"
              min={200}
              max={500}
              value={val}
              onChange={handle(key)}
              className="text-center pr-6 text-sm h-9"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">ft</span>
          </div>
        </div>
      ))}
    </div>
  );
}