import React, { useState } from 'react';
import { getSavedRepertoire } from '@/lib/pitcherRepertoireStore';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function PitchAdvisor({ pitcher, currentBatter, balls, strikes, runners, atBatHistory = [], pitchesSoFar = [] }) {
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);

  const getAdvice = async () => {
    setLoading(true);
    setAdvice(null);

    // Use passed repertoire, or load from persistent store by pitcher name
    let rep = pitcher?.pitch_repertoire || [];
    if (rep.length === 0 && pitcher?.name) {
      rep = getSavedRepertoire(pitcher.name);
    }
    const repertoire = rep.length > 0 ? rep.join(', ') : 'unknown';

    const pitchLog = pitchesSoFar.length > 0
      ? pitchesSoFar.map((p, i) => `${i + 1}. ${p.pitch_type} → ${p.result}`).join('\n')
      : 'None yet';

    const batterHistory = atBatHistory.length > 0
      ? atBatHistory.map(ab => `${ab.result} (${ab.balls}B-${ab.strikes}K)`).join(', ')
      : 'No prior history this game';

    const prompt = `You are an expert baseball pitching coach. Based on the situation below, answer ONLY these two questions:

1. What pitches tend to give this batter trouble?
2. What is your recommended next pitch and why?

SITUATION:
- Count: ${balls} balls, ${strikes} strikes
- Runners on base: ${runners}
- Pitcher's repertoire: ${repertoire}
- Batter: ${currentBatter?.name || 'Unknown'} (bats ${currentBatter?.hand || currentBatter?.bats || '?'})
- Batter's results this game: ${batterHistory}
- Pitches thrown so far this at-bat:
${pitchLog}

Be concise and direct. Focus on pitch selection strategy only.`;

    try {
      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      setAdvice(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-accent/40 bg-accent/5">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-accent" />
          Pitching Coach
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={getAdvice}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {advice ? 'Refresh' : 'Get Advice'}
        </Button>
      </CardHeader>
      <CardContent>
        {!advice && !loading && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Tap "Pitching Coach" for pitch recommendations based on the current situation.
          </p>
        )}
        {loading && (
          <div className="flex items-center gap-2 py-3 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin text-accent" />
            <span className="text-xs text-muted-foreground">Analyzing situation…</span>
          </div>
        )}
        {advice && (
          <ReactMarkdown className="text-xs prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_strong]:font-semibold [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_ol]:my-1">
            {advice}
          </ReactMarkdown>
        )}
      </CardContent>
    </Card>
  );
}