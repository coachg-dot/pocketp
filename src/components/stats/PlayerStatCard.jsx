import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { cn } from "@/lib/utils";
import { exportPlayerCardPDF } from '../../utils/exportPlayerPDF';

const fmt3 = (val) => val != null ? `.${(val * 1000).toFixed(0).padStart(3, '0')}` : '---';
const fmtPct = (val) => val != null ? `${(val * 100).toFixed(1)}%` : '---';
const fmtNum = (val) => val != null ? val.toFixed(1) : '---';
const fmtInt = (val) => val != null ? val : 0;

export default function PlayerStatCard({ player, rank, sortKey }) {
  const [expanded, setExpanded] = useState(false);

  const highlightStat = (key) => key === sortKey
    ? 'text-primary font-bold'
    : 'text-foreground font-medium';

  return (
    <Card className={cn("transition-all", expanded && "border-primary/30")}>
      <CardContent className="p-4">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-5 font-medium">#{rank}</span>
            <div>
              <span className="font-semibold text-sm">{(player.name || '').toUpperCase()}</span>
              {player.position && (
                <span className="text-xs text-muted-foreground ml-1.5">{player.position}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); exportPlayerCardPDF(player); }}
              className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-primary"
              title="Export PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <div className="text-right">
              <p className={cn("text-lg", highlightStat('avg'))}>{fmt3(player.avg)}</p>
              <p className="text-xs text-muted-foreground">AVG</p>
            </div>
            <div className="text-right">
              <p className={cn("text-lg", highlightStat('ops'))}>{fmt3(player.ops)}</p>
              <p className="text-xs text-muted-foreground">OPS</p>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* Traditional quick row */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {[
            { key: 'atBats', label: 'AB', val: fmtInt(player.atBats) },
            { key: 'hits', label: 'H', val: fmtInt(player.hits) },
            { key: 'homeRuns', label: 'HR', val: fmtInt(player.homeRuns) },
            { key: 'rbis', label: 'RBI', val: fmtInt(player.rbis) },
            { key: 'walks', label: 'BB', val: fmtInt(player.walks) },
            { key: 'strikeouts', label: 'K', val: fmtInt(player.strikeouts) },
            { key: 'risp', label: 'RISP', val: fmt3(player.risp) },
          ].map(({ key, label, val }) => (
            <div key={key}>
              <p className={cn("text-xs", highlightStat(key))}>{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Expanded: full advanced stats */}
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Rate stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rate Stats</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { key: 'obp', label: 'OBP', val: fmt3(player.obp) },
                  { key: 'slg', label: 'SLG', val: fmt3(player.slg) },
                  { key: 'ops', label: 'OPS', val: fmt3(player.ops) },
                  { key: 'risp', label: 'RISP', val: fmt3(player.risp) },
                ].map(({ key, label, val }) => (
                  <div key={key} className={cn("p-2 rounded-lg", sortKey === key ? "bg-primary/10" : "bg-muted/50")}>
                    <p className={cn("font-semibold text-sm", highlightStat(key))}>{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hit breakdown */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hit Breakdown</p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { key: 'singles', label: '1B', val: fmtInt(player.singles) },
                  { key: 'doubles', label: '2B', val: fmtInt(player.doubles) },
                  { key: 'triples', label: '3B', val: fmtInt(player.triples) },
                  { key: 'homeRuns', label: 'HR', val: fmtInt(player.homeRuns) },
                  { key: 'totalBases', label: 'TB', val: fmtInt(player.totalBases) },
                ].map(({ key, label, val }) => (
                  <div key={key} className={cn("p-2 rounded-lg", sortKey === key ? "bg-primary/10" : "bg-muted/50")}>
                    <p className={cn("font-semibold text-sm", highlightStat(key))}>{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sabermetrics */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sabermetrics</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { key: 'iso', label: 'ISO', val: fmt3(player.iso), tip: 'Isolated Power' },
                  { key: 'babip', label: 'BABIP', val: fmt3(player.babip), tip: 'Batting Avg on Balls In Play' },
                  { key: 'ops_plus', label: 'OPS+', val: player.ops_plus != null ? Math.round(player.ops_plus) : '---', tip: 'OPS+ (100 = avg)' },
                  { key: 'bb_pct', label: 'BB%', val: fmtPct(player.bb_pct), tip: 'Walk Rate' },
                  { key: 'k_pct', label: 'K%', val: fmtPct(player.k_pct), tip: 'Strikeout Rate' },
                  { key: 'bb_k', label: 'BB/K', val: player.bb_k != null ? player.bb_k.toFixed(2) : '---', tip: 'Walk-to-Strikeout Ratio' },
                ].map(({ key, label, val, tip }) => (
                  <div key={key} className={cn("p-2 rounded-lg", sortKey === key ? "bg-primary/10" : "bg-muted/50")} title={tip}>
                    <p className={cn("font-semibold text-sm", highlightStat(key))}>{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact quality */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact Quality</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { key: 'hard_contact', label: 'HardH%', val: fmtPct(player.hard_contact), tip: 'Hard Contact % (XBH / BIP)' },
                  { key: 'gb_pct', label: 'GB%', val: fmtPct(player.gb_pct), tip: 'Ground Ball %' },
                  { key: 'fb_pct', label: 'FB%', val: fmtPct(player.fb_pct), tip: 'Fly Ball %' },
                ].map(({ key, label, val, tip }) => (
                  <div key={key} className={cn("p-2 rounded-lg", sortKey === key ? "bg-primary/10" : "bg-muted/50")} title={tip}>
                    <p className={cn("font-semibold text-sm", highlightStat(key))}>{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}