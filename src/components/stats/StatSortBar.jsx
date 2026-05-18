import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from 'lucide-react';

const SORT_CATEGORIES = [
  { label: 'Traditional', stats: [
    { key: 'avg', label: 'AVG' },
    { key: 'obp', label: 'OBP' },
    { key: 'slg', label: 'SLG' },
    { key: 'ops', label: 'OPS' },
    { key: 'hits', label: 'H' },
    { key: 'homeRuns', label: 'HR' },
    { key: 'rbis', label: 'RBI' },
    { key: 'walks', label: 'BB' },
    { key: 'strikeouts', label: 'K' },
    { key: 'risp', label: 'RISP' },
  ]},
  { label: 'Sabermetrics', stats: [
    { key: 'ops_plus', label: 'OPS+' },
    { key: 'iso', label: 'ISO' },
    { key: 'babip', label: 'BABIP' },
    { key: 'bb_pct', label: 'BB%' },
    { key: 'k_pct', label: 'K%' },
    { key: 'bb_k', label: 'BB/K' },
    { key: 'hard_contact', label: 'HardH%' },
    { key: 'singles', label: '1B' },
    { key: 'doubles', label: '2B' },
    { key: 'triples', label: '3B' },
  ]},
];

export default function StatSortBar({ sortKey, sortDir, onSort }) {
  const [activeCategory, setActiveCategory] = React.useState(0);

  const handleSort = (key) => {
    if (sortKey === key) {
      onSort(key, sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      onSort(key, 'desc');
    }
  };

  return (
    <div className="space-y-2">
      {/* Category tabs */}
      <div className="flex gap-2">
        {SORT_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => setActiveCategory(i)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold transition-all",
              activeCategory === i
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Stat buttons */}
      <div className="flex flex-wrap gap-1.5">
        {SORT_CATEGORIES[activeCategory].stats.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={cn(
              "flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
              sortKey === key
                ? "bg-primary text-primary-foreground shadow"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {label}
            {sortKey === key && (
              sortDir === 'desc'
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronUp className="w-3 h-3" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}