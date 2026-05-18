import React, { useState, useEffect } from 'react';
import { getSavedRepertoire, saveRepertoire, getActivePitcherForGame } from '@/lib/pitcherRepertoireStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { Loader2, ClipboardList, Download, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';

export default function ScoutingReport({ player, open, onClose, pitcherRepertoire = [] }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const isPitcher = player?.isPitcherInGame || player?.pitch_repertoire?.length > 0 || player?.position === 'P';

  const generate = async () => {
    setLoading(true);
    setReport(null);

    // For in-game pitchers (no stored ID), skip DB lookups
    const [atBats, pitches] = player?.isPitcherInGame
      ? [[], []]
      : await Promise.all([
          base44.entities.AtBat.filter({ player_id: player.id }),
          base44.entities.Pitch.filter({ player_id: player.id }),
        ]);

    let prompt = '';

    if (isPitcher) {
      // Resolve repertoire: player entity field → user-scoped store → active game pitcher → empty
      const storedRep = getSavedRepertoire(player.name);
      const resolvedRepArray = storedRep.length > 0 ? storedRep : (player.pitch_repertoire || []);
      const repertoire = resolvedRepArray.join(', ');
      const totalPitches = pitches.length;
      const pitchBreakdown = {};
      const resultBreakdown = {};
      pitches.forEach(p => {
        pitchBreakdown[p.pitch_type] = (pitchBreakdown[p.pitch_type] || 0) + 1;
        resultBreakdown[p.result] = (resultBreakdown[p.result] || 0) + 1;
      });
      const hasPitchData = totalPitches > 0;

      const strikePercent = totalPitches > 0
        ? Math.round(((resultBreakdown['called_strike'] || 0) + (resultBreakdown['swinging_strike'] || 0) + (resultBreakdown['foul'] || 0) + (resultBreakdown['in_play_out'] || 0) + (resultBreakdown['in_play_hit'] || 0)) / totalPitches * 100)
        : 0;

      prompt = `You are a baseball scout. Be SHORT, blunt, and data-driven. No overview, no fluff.

PITCHER: ${player.name} | THROWS: ${player.throws || 'Unknown'} | REPERTOIRE: ${repertoire || 'Unknown'}
PITCHES TRACKED: ${totalPitches}
USAGE: ${hasPitchData ? Object.entries(pitchBreakdown).map(([k, v]) => `${k} ${Math.round(v/totalPitches*100)}%`).join(', ') : 'none yet'}
OUTCOMES: ${hasPitchData ? Object.entries(resultBreakdown).map(([k, v]) => `${k}:${v}`).join(', ') : 'none yet'}

CRITICAL: This pitcher's ONLY available pitches are: ${repertoire || 'unknown'}. Do NOT suggest any pitch not in this list.

Answer EXACTLY these two questions. No intro, no overview section, no summary. Just these two headers and answers:

**What Pitches Give This Batter Trouble?**
Which specific pitches (from repertoire only) and locations get this batter out? Be specific about zones (e.g., "elevated fastball", "slider low and away"). Reference the outcome data directly.

**Pitch Sequence to Get an Out**
Give a concrete pitch-by-pitch sequence using ONLY pitches from the repertoire. Cover both hitter's counts and pitcher's counts. State what to avoid.`;

    } else {
      const totalABs = atBats.length;
      const hits = atBats.filter(ab => ['single','double','triple','home_run','bunt_single'].includes(ab.result)).length;
      const xbh = atBats.filter(ab => ['double','triple','home_run'].includes(ab.result)).length;
      const walks = atBats.filter(ab => ab.result === 'walk' || ab.result === 'hbp').length;
      const strikeouts = atBats.filter(ab => ab.result?.includes('strikeout')).length;
      const groundouts = atBats.filter(ab => ['groundout','double_play','triple_play'].includes(ab.result)).length;
      const flyouts = atBats.filter(ab => ['flyout','sac_fly','popout'].includes(ab.result)).length;
      const avg = totalABs > 0 ? (hits / totalABs).toFixed(3) : '.000';

      const resultBreakdown = {};
      atBats.forEach(ab => {
        resultBreakdown[ab.result] = (resultBreakdown[ab.result] || 0) + 1;
      });

      const situationalHits = {};
      atBats.forEach(ab => {
        if (ab.runners_on_base && ab.runners_on_base !== 'none') {
          const isHit = ['single','double','triple','home_run','bunt_single'].includes(ab.result);
          if (!situationalHits[ab.runners_on_base]) situationalHits[ab.runners_on_base] = { abs: 0, hits: 0 };
          situationalHits[ab.runners_on_base].abs++;
          if (isHit) situationalHits[ab.runners_on_base].hits++;
        }
      });

      // Use directly passed pitcher repertoire, then check active game pitcher, then per-pitcher store
      let ourPitcherRepertoire = pitcherRepertoire.length > 0 ? pitcherRepertoire.join(', ') : null;
      if (!ourPitcherRepertoire) {
        // Try to get active pitcher from current game via URL param
        const gameId = new URLSearchParams(window.location.search).get('id');
        const activePitcher = getActivePitcherForGame(gameId);
        if (activePitcher?.pitch_repertoire?.length > 0) {
          ourPitcherRepertoire = activePitcher.pitch_repertoire.join(', ');
        } else if (activePitcher?.name) {
          // Fallback: look up by name in the per-pitcher repertoire store
          const saved = getSavedRepertoire(activePitcher.name);
          if (saved.length > 0) ourPitcherRepertoire = saved.join(', ');
        }
      }

      const repertoireConstraint = ourPitcherRepertoire
        ? `\nOUR PITCHER'S REPERTOIRE: ${ourPitcherRepertoire}\nCRITICAL: Every pitch recommendation must use ONLY pitches from our pitcher's repertoire: ${ourPitcherRepertoire}. Do NOT suggest any pitch not in this list.`
        : '';

      prompt = `You are a baseball scout. Be SHORT, blunt, and data-driven. No overview, no fluff.

HITTER: ${player.name} | BATS: ${player.bats || 'Unknown'} | POS: ${player.position || 'Unknown'}
ABS: ${totalABs} | AVG: ${avg} | K: ${strikeouts} | BB: ${walks} | XBH: ${xbh}
GB: ${groundouts} | FB: ${flyouts}
RESULTS: ${Object.entries(resultBreakdown).map(([k, v]) => `${k}:${v}`).join(', ')}
SITUATIONAL: ${Object.keys(situationalHits).length > 0 ? Object.entries(situationalHits).map(([k, v]) => `${k} ${v.hits}/${v.abs}`).join(', ') : 'limited data'}${repertoireConstraint}

Answer EXACTLY these two questions. No intro, no overview section, no summary. Just these two headers and answers:

**What Pitches Give This Batter Trouble?**
Based on the at-bat results, which pitch types and locations lead to outs? Call out specific zones (e.g., "down and in", "elevated fastball", "breaking ball away"). Reference strikeout and weak-contact data directly.

**Pitch Sequence to Get an Out**
Give a concrete pitch-by-pitch sequence recommendation${ourPitcherRepertoire ? ` using ONLY pitches from our repertoire (${ourPitcherRepertoire})` : ''}. Cover hitter's counts vs. pitcher's counts. State what to avoid.`;
    }

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setReport(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    setLoading(false);
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    const title = `Scouting Report – ${player?.name}`;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Type: ${isPitcher ? 'Pitcher' : 'Hitter'} | Generated: ${new Date().toLocaleDateString()}`, 14, 28);

    doc.setLineWidth(0.5);
    doc.line(14, 31, 196, 31);

    const plainText = report.replace(/\*\*/g, '').replace(/\*/g, '');
    const lines = doc.splitTextToSize(plainText, 180);
    let y = 38;
    lines.forEach(line => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 6;
    });

    doc.save(`scouting-report-${player?.name?.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  // Auto-generate on open
  useEffect(() => {
    if (open && !loading) {
      setReport(null);
      generate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, player?.id, player?.name]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Scouting Report – {player?.name}
            <span className="text-xs font-normal text-muted-foreground ml-1">({isPitcher ? 'Pitcher' : 'Hitter'})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-muted-foreground text-sm">Generating scouting report…</span>
            </div>
          )}

          {report && !loading && (
            <div className="prose prose-sm max-w-none text-foreground py-2 pr-1">
              <ReactMarkdown
                components={{
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                  h2: ({ children }) => <h2 className="text-base font-bold mt-4 mb-1 text-primary">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>,
                }}
              >
                {report}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {report && !loading && (
          <div className="flex gap-2 pt-3 border-t shrink-0">
            <Button variant="outline" className="flex-1 gap-2" onClick={exportPDF}>
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
            <Button variant="ghost" className="flex-1 gap-2" onClick={generate}>
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}