import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X, ClipboardList, Grid3x3 } from 'lucide-react';
import ScoutingReport from './ScoutingReport';
import StrikeZoneGrid from './StrikeZoneGrid';
import BaseballDiamond from './BaseballDiamond';

const IN_PLAY_RESULTS = ['in_play_out', 'in_play_hit', 'error'];

const PITCH_TYPES = [
  { id: '4seam',       label: '4S',  full: '4-Seam FB',    color: 'bg-red-500' },
  { id: '2seam',       label: '2S',  full: '2-Seam FB',    color: 'bg-red-400' },
  { id: 'sinker',      label: 'SI',  full: 'Sinker',       color: 'bg-orange-500' },
  { id: 'cutter',      label: 'CT',  full: 'Cutter',       color: 'bg-orange-400' },
  { id: 'slider',      label: 'SL',  full: 'Slider',       color: 'bg-purple-500' },
  { id: 'sweeper',     label: 'SW',  full: 'Sweeper',      color: 'bg-purple-400' },
  { id: 'slurve',      label: 'SLV', full: 'Slurve',       color: 'bg-violet-500' },
  { id: 'curveball',   label: 'CB',  full: 'Curveball',    color: 'bg-blue-500' },
  { id: 'knuckle_curve', label: 'KC', full: 'Knuckle Curve', color: 'bg-blue-400' },
  { id: 'changeup',    label: 'CH',  full: 'Changeup',     color: 'bg-green-500' },
  { id: 'splitter',    label: 'SP',  full: 'Splitter',     color: 'bg-green-400' },
  { id: 'screwball',   label: 'SCR', full: 'Screwball',    color: 'bg-teal-500' },
  { id: 'forkball',    label: 'FK',  full: 'Forkball',     color: 'bg-cyan-500' },
  { id: 'knuckleball', label: 'KN',  full: 'Knuckleball',  color: 'bg-gray-500' },
  { id: 'eephus',      label: 'EP',  full: 'Eephus',       color: 'bg-pink-400' },
];

const PITCH_RESULTS = [
  { id: 'ball', label: 'Ball', short: 'B' },
  { id: 'called_strike', label: 'Called K', short: 'CK' },
  { id: 'swinging_strike', label: 'Swing K', short: 'SK' },
  { id: 'foul', label: 'Foul', short: 'F' },
  { id: 'foul_tip', label: 'Foul Tip', short: 'FT' },
  { id: 'in_play_out', label: 'In Play Out', short: 'IPO' },
  { id: 'in_play_hit', label: 'In Play Hit', short: 'IPH' },
  { id: 'hit_by_pitch', label: 'HBP', short: 'HBP' },
  { id: 'error', label: 'Error (reach)', short: 'E' },
];

export default function PitchTracker({ pitches = [], onAddPitch, onRemovePitch, currentBatter, repertoire = [], balls = 0, strikes = 0 }) {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [hitLocation, setHitLocation] = useState(null);
  const [hitType, setHitType] = useState(null);
  const [showZone, setShowZone] = useState(false);
  const [showScouting, setShowScouting] = useState(false);

  const HIT_TYPES = [
    { id: 'single', label: '1B' },
    { id: 'double', label: '2B' },
    { id: 'triple', label: '3B' },
    { id: 'home_run', label: 'HR' },
  ];

  // Pitcher's selected pitches appear first, all others follow as secondary options
  const primaryTypes = repertoire.length > 0 ? PITCH_TYPES.filter(pt => repertoire.includes(pt.id)) : [];
  const secondaryTypes = PITCH_TYPES.filter(pt => !repertoire.includes(pt.id));
  const pitchSections = repertoire.length > 0
    ? [{ section: 'primary', types: primaryTypes }, { section: 'secondary', types: secondaryTypes }]
    : [{ section: 'primary', types: PITCH_TYPES }];

  const isInPlay = IN_PLAY_RESULTS.includes(selectedResult);

  const handleLog = () => {
    if (!selectedType || !selectedResult) return;
    if (selectedResult === 'in_play_hit' && !hitType) return;
    onAddPitch({
      pitch_type: selectedType,
      result: selectedResult,
      pitch_number: pitches.length + 1,
      ...(showZone && selectedZone != null ? { zone: selectedZone } : {}),
      ...(isInPlay && hitLocation ? { hit_location_x: hitLocation.x, hit_location_y: hitLocation.y } : {}),
      ...(selectedResult === 'in_play_hit' && hitType ? { hit_type: hitType } : {}),
    });
    setSelectedType(null);
    setSelectedResult(null);
    setSelectedZone(null);
    setHitLocation(null);
    setHitType(null);
    window.navigator?.vibrate?.(10);
  };

  const getPitchColor = (type) => PITCH_TYPES.find(p => p.id === type)?.color || 'bg-gray-400';
  const getPitchLabel = (type) => PITCH_TYPES.find(p => p.id === type)?.label || type;
  const getResultShort = (result) => PITCH_RESULTS.find(r => r.id === result)?.short || result;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pitch Sequence</CardTitle>
          {(balls > 0 || strikes > 0 || pitches.length > 0) && (
            <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">{balls}-{strikes}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Switch id="zone-toggle" checked={showZone} onCheckedChange={setShowZone} className="scale-75" />
            <Label htmlFor="zone-toggle" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
              <Grid3x3 className="w-3 h-3" /> Zone
            </Label>
          </div>
          {currentBatter && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowScouting(true)}>
              <ClipboardList className="w-3.5 h-3.5" />
              Scout
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pitch sequence display */}
        {pitches.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pitches.map((p, i) => (
              <div key={i} className="flex items-center gap-1 bg-muted rounded-full px-2 py-0.5">
                <span className={`w-5 h-5 rounded-full ${getPitchColor(p.pitch_type)} flex items-center justify-center text-white text-[9px] font-bold`}>
                  {getPitchLabel(p.pitch_type)}
                </span>
                <span className="text-xs text-muted-foreground">{getResultShort(p.result)}</span>
                <button onClick={() => onRemovePitch(i)} className="text-muted-foreground/50 hover:text-destructive ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pitch type selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Pitch Type</p>
          {pitchSections.map(({ section, types }) => (
            types.length > 0 && (
              <div key={section}>
                {section === 'secondary' && (
                  <p className="text-[10px] text-muted-foreground/60 mt-2 mb-1">Other Pitches</p>
                )}
                <div className="grid grid-cols-4 gap-1.5">
                  {types.map(pt => (
                    <button
                      key={pt.id}
                      onClick={() => setSelectedType(pt.id)}
                      className={`rounded-lg py-2 text-xs font-semibold border-2 transition-all ${
                        selectedType === pt.id
                          ? `${pt.color} text-white border-transparent`
                          : section === 'secondary'
                            ? 'bg-muted/50 text-muted-foreground/60 border-transparent hover:border-muted-foreground/30'
                            : 'bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30'
                      }`}
                    >
                      {pt.full}
                    </button>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>

        {/* Result selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Result</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PITCH_RESULTS.map(pr => (
              <button
                key={pr.id}
                onClick={() => { setSelectedResult(pr.id); if (!IN_PLAY_RESULTS.includes(pr.id)) setHitLocation(null); }}
                className={`rounded-lg py-2 text-xs font-semibold border-2 transition-all ${
                  selectedResult === pr.id
                    ? 'bg-primary text-primary-foreground border-transparent'
                    : 'bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30'
                }`}
              >
                {pr.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hit location for in-play results */}
        {isInPlay && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Hit Location <span className="text-[10px]">(optional)</span></p>
            <BaseballDiamond
              onLocationSelect={setHitLocation}
              selectedLocation={hitLocation}
            />
          </div>
        )}

        {/* Hit type selector for in-play hits */}
        {selectedResult === 'in_play_hit' && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Hit Type <span className="text-destructive">*</span></p>
            <div className="grid grid-cols-4 gap-1.5">
              {HIT_TYPES.map(ht => (
                <button
                  key={ht.id}
                  onClick={() => setHitType(ht.id)}
                  className={`rounded-lg py-2 text-sm font-bold border-2 transition-all ${
                    hitType === ht.id
                      ? 'bg-primary text-primary-foreground border-transparent'
                      : 'bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  {ht.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Strike zone grid (optional) */}
        {showZone && (
          <div className="bg-muted/30 rounded-xl p-3">
            <StrikeZoneGrid
              pitches={pitches}
              selectedZone={selectedZone}
              onZoneSelect={(z) => setSelectedZone(prev => prev === z ? null : z)}

            />
          </div>
        )}

        <Button
          size="sm"
          className="w-full"
          disabled={!selectedType || !selectedResult}
          onClick={handleLog}
        >
          + Log Pitch{showZone && selectedZone != null ? ` (Zone ${selectedZone})` : ''}
        </Button>
      </CardContent>

      {showScouting && currentBatter && (
        <ScoutingReport
          player={currentBatter}
          open={showScouting}
          onClose={() => setShowScouting(false)}
          pitcherRepertoire={repertoire}
        />
      )}
    </Card>
  );
}

export { PITCH_TYPES, PITCH_RESULTS };