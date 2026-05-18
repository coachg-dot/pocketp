import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Zap } from 'lucide-react';

// Pitch family groupings
const OFFSPEED = ['changeup', 'splitter', 'screwball', 'forkball', 'eephus'];
const BREAKING = ['slider', 'sweeper', 'slurve', 'curveball', 'knuckle_curve'];
const FASTBALLS = ['4seam', '2seam', 'fastball', 'sinker', 'cutter', 'knuckleball'];

const PITCH_FAMILY_LABEL = {
  offspeed: 'Off-Speed',
  breaking: 'Breaking Balls',
  fastball: 'Fastballs',
};

function getPitchFamily(type) {
  if (OFFSPEED.includes(type)) return 'offspeed';
  if (BREAKING.includes(type)) return 'breaking';
  if (FASTBALLS.includes(type)) return 'fastball';
  return null;
}

const HIT_RESULTS = ['single', 'double', 'triple', 'home_run', 'bunt_single'];
const AT_BAT_RESULTS = ['single','double','triple','home_run','bunt_single','groundout','flyout','lineout',
  'popout','strikeout_swinging','strikeout_looking','fielders_choice','double_play','triple_play',
  'error','rbi_groundout','bunt_out'];

/**
 * Compute weakness flags for a batter given their pitch-level records.
 * Each pitch record has pitch_type, result (pitch result), at_bat_result.
 */
export function computeWeaknessFlags(pitches, atBats) {
  const flags = [];

  // ── 1. Strikeout rate overall ──────────────────────────────────────────
  const officialABs = atBats.filter(ab => AT_BAT_RESULTS.includes(ab.result)).length;
  const totalKs = atBats.filter(ab => ab.result?.includes('strikeout')).length;
  const kRate = officialABs > 0 ? totalKs / officialABs : null;
  if (kRate !== null && kRate >= 0.30) {
    flags.push({
      severity: 'high',
      icon: 'strikeout',
      label: `High K rate — ${Math.round(kRate * 100)}%`,
      detail: `Strikes out in ${Math.round(kRate * 100)}% of official at-bats (threshold: 30%).`,
    });
  }

  // ── 2. Struggles vs pitch families (require ≥5 PA per family) ─────────
  const familyMap = { offspeed: { hits: 0, abs: 0, ks: 0 }, breaking: { hits: 0, abs: 0, ks: 0 }, fastball: { hits: 0, abs: 0, ks: 0 } };

  atBats.forEach(ab => {
    // Find pitches for this specific at-bat using at_bat_id linkage only (most accurate)
    const abPitches = pitches.filter(p => p.at_bat_id === ab.id);
    // Best-guess: use the pitch type from the last pitch in the sequence
    const sorted = [...abPitches].sort((a, b) => (a.pitch_number || 0) - (b.pitch_number || 0));
    const lastPitch = sorted[sorted.length - 1];
    if (!lastPitch?.pitch_type) return;
    const family = getPitchFamily(lastPitch.pitch_type);
    if (!family) return;
    if (AT_BAT_RESULTS.includes(ab.result)) familyMap[family].abs++;
    if (HIT_RESULTS.includes(ab.result)) familyMap[family].hits++;
    if (ab.result?.includes('strikeout')) familyMap[family].ks++;
  });

  Object.entries(familyMap).forEach(([family, { hits, abs, ks }]) => {
    if (abs < 5) return;
    const avg = hits / abs;
    const kPct = ks / abs;
    if (avg < 0.150) {
      flags.push({
        severity: 'high',
        icon: 'pitch',
        label: `Struggles vs ${PITCH_FAMILY_LABEL[family]} — .${String(Math.round(avg * 1000)).padStart(3, '0')} AVG`,
        detail: `Only ${hits} hits in ${abs} official ABs against ${PITCH_FAMILY_LABEL[family].toLowerCase()}.`,
      });
    } else if (avg < 0.200) {
      flags.push({
        severity: 'medium',
        icon: 'pitch',
        label: `Weak vs ${PITCH_FAMILY_LABEL[family]} — .${String(Math.round(avg * 1000)).padStart(3, '0')} AVG`,
        detail: `Batting .${String(Math.round(avg * 1000)).padStart(3,'0')} in ${abs} ABs against ${PITCH_FAMILY_LABEL[family].toLowerCase()}.`,
      });
    }
    if (kPct >= 0.35 && abs >= 5) {
      flags.push({
        severity: 'medium',
        icon: 'strikeout',
        label: `High K% vs ${PITCH_FAMILY_LABEL[family]} — ${Math.round(kPct * 100)}%`,
        detail: `Strikes out ${Math.round(kPct * 100)}% of ABs facing ${PITCH_FAMILY_LABEL[family].toLowerCase()}.`,
      });
    }
  });

  // ── 3. RISP struggles ──────────────────────────────────────────────────
  const RISP_SITUATIONS = ['second','third','first_second','first_third','second_third','bases_loaded'];
  const rispABs = atBats.filter(ab => RISP_SITUATIONS.includes(ab.runners_on_base) && AT_BAT_RESULTS.includes(ab.result));
  const rispHits = rispABs.filter(ab => HIT_RESULTS.includes(ab.result)).length;
  if (rispABs.length >= 5) {
    const rispAvg = rispHits / rispABs.length;
    if (rispAvg < 0.175) {
      flags.push({
        severity: 'high',
        icon: 'risp',
        label: `Poor RISP — .${String(Math.round(rispAvg * 1000)).padStart(3,'0')} AVG`,
        detail: `${rispHits} for ${rispABs.length} with runners in scoring position.`,
      });
    }
  }

  // ── 4. Ground ball tendency (weak contact) ─────────────────────────────
  const GB_RESULTS = ['groundout', 'double_play', 'rbi_groundout', 'fielders_choice'];
  const FB_RESULTS = ['flyout', 'sac_fly', 'home_run'];
  const bip = atBats.filter(ab => [...GB_RESULTS, ...FB_RESULTS, 'lineout','popout','single','double','triple','bunt_single'].includes(ab.result));
  const gbs = bip.filter(ab => GB_RESULTS.includes(ab.result));
  if (bip.length >= 8 && gbs.length / bip.length > 0.60) {
    flags.push({
      severity: 'low',
      icon: 'contact',
      label: `Ground ball tendency — ${Math.round((gbs.length / bip.length) * 100)}% GB rate`,
      detail: `${gbs.length} of ${bip.length} balls in play are grounders. Pitch down in the zone.`,
    });
  }

  return flags;
}

const SEVERITY_STYLES = {
  high:   'border-destructive/40 bg-destructive/10 text-destructive',
  medium: 'border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  low:    'border-muted bg-muted/40 text-muted-foreground',
};

const SEVERITY_BADGE = {
  high:   'bg-destructive text-destructive-foreground',
  medium: 'bg-amber-500 text-white',
  low:    'bg-muted text-muted-foreground',
};

export default function BatterWeaknessFlags({ flags }) {
  if (!flags || flags.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        Not enough data to flag weaknesses yet (need ≥5 at-bats).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {flags.map((flag, i) => (
        <div key={i} className={`rounded-xl border px-3 py-2.5 ${SEVERITY_STYLES[flag.severity]}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold">{flag.label}</span>
                <Badge className={`text-[9px] px-1.5 py-0 h-4 ${SEVERITY_BADGE[flag.severity]}`}>
                  {flag.severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-[10px] opacity-80 mt-0.5">{flag.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}