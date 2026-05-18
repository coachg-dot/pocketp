import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Target } from 'lucide-react';
import { createPageUrl } from '@/utils';
import SessionSetup from '../components/practice/SessionSetup';
import ScenarioBuilder from '../components/practice/ScenarioBuilder';
import ScenarioDisplay from '../components/practice/ScenarioDisplay';
import GoalPrompt from '../components/practice/GoalPrompt';
import ReportCard from '../components/practice/ReportCard';

const RUNNER_OPTIONS = ['none','first','second','third','first_second','first_third','second_third','bases_loaded'];

function randomScenario(mode) {
  const s = {
    balls: Math.floor(Math.random() * 4),
    strikes: Math.floor(Math.random() * 3),
    outs: Math.floor(Math.random() * 3),
    inning: Math.floor(Math.random() * 9) + 1,
    runners: RUNNER_OPTIONS[Math.floor(Math.random() * RUNNER_OPTIONS.length)],
    hitterSide: Math.random() < 0.5 ? 'right' : 'left',
  };
  if (mode === 'hitting') s.pitcherSide = Math.random() < 0.5 ? 'right' : 'left';
  return s;
}

// steps: mode → setup → scenario → goal → result → [next scenario or report]
export default function Practice() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [session, setSession] = useState(null); // { total, useRandom, playerConfig, ... }
  const [step, setStep] = useState('mode'); // mode | setup | scenario | goal | result | report
  const [scenario, setScenario] = useState(null);
  const [goal, setGoal] = useState(null);
  const [history, setHistory] = useState([]); // [{scenario, goal, passed}]
  const [playerIndex, setPlayerIndex] = useState(0); // tracks position in staff/lineup rotation
  const current = history.length + 1;

  // Derive the current player name from session config
  const getCurrentPlayer = (cfg, idx) => {
    if (!cfg?.playerConfig) return null;
    const { sessionType, lineup } = cfg.playerConfig;
    if (sessionType === 'open') return null;
    if (sessionType === 'rotation' || sessionType === 'lineup') {
      return lineup?.[idx % (lineup?.length || 1)] || null;
    }
    return null;
  };

  const advancePlayer = (cfg, idx) => {
    const pc = cfg?.playerConfig;
    if (!pc) return idx;
    if (pc.sessionType === 'rotation' || pc.sessionType === 'lineup') {
      return (idx + 1) % (pc.lineup?.length || 1);
    }
    return idx;
  };

  const handleModeSelect = (m) => { setMode(m); setStep('setup'); };

  const handleSessionStart = (cfg) => {
    setSession(cfg);
    setHistory([]);
    setPlayerIndex(0);
    if (cfg.useRandom) {
      setScenario(randomScenario(mode));
      setStep('goal');
    } else {
      setStep('scenario');
    }
  };

  const handleScenarioReady = (s) => { setScenario(s); setStep('goal'); };
  const handleRandomScenario = () => { setScenario(randomScenario(mode)); setStep('goal'); };

  const handleGoalSet = (g) => { setGoal(g); setStep('result'); };

  const handleResult = (passed) => {
    const newHistory = [...history, { scenario, goal, passed }];
    setHistory(newHistory);
    const nextIdx = advancePlayer(session, playerIndex);
    setPlayerIndex(nextIdx);
    if (session.total !== 'unlimited' && newHistory.length >= session.total) {
      setStep('report');
    } else {
      // next scenario
      if (session.useRandom) {
        setScenario(randomScenario(mode));
        setGoal(null);
        setStep('goal');
      } else {
        setScenario(null);
        setGoal(null);
        setStep('scenario');
      }
    }
  };

  const handleBack = () => {
    if (step === 'report') { resetAll(); }
    else if (step === 'result') { setStep('goal'); }
    else if (step === 'goal') { session?.useRandom ? setStep('scenario') : setStep('scenario'); setScenario(null); }
    else if (step === 'scenario') { setStep('setup'); }
    else if (step === 'setup') { setMode(null); setStep('mode'); }
    else navigate(createPageUrl('Home'));
  };

  const resetAll = () => {
    setMode(null); setSession(null); setStep('mode');
    setScenario(null); setGoal(null); setHistory([]);
    setPlayerIndex(0);
  };

  const progress = session ? (session.total !== 'unlimited' ? `${current - 1} / ${session.total}` : `${current - 1}`) : '';

  // Current player label for header
  const currentPlayerLabel = (() => {
    if (!session?.playerConfig) return null;
    const { sessionType, lineup } = session.playerConfig;
    if (sessionType === 'open') return null;
    if (sessionType === 'rotation' || sessionType === 'lineup') {
      return lineup?.[playerIndex % (lineup?.length || 1)] || null;
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 py-4 pt-safe sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Practice Scenarios</h1>
            {mode && step !== 'mode' && step !== 'setup' && step !== 'report' && (
              <p className="text-xs text-primary-foreground/70 capitalize">
                {mode} • Scenario {progress}
                {currentPlayerLabel ? ` • ${currentPlayerLabel}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {step === 'mode' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">Choose a practice mode</p>
            <div className="grid grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary/60 transition-colors" onClick={() => handleModeSelect('pitching')}>
                <CardContent className="py-8 flex flex-col items-center gap-2">
                  <Target className="w-8 h-8 text-primary" />
                  <p className="font-semibold">Pitching</p>
                  <p className="text-xs text-muted-foreground text-center">Scenarios for pitchers</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:border-primary/60 transition-colors" onClick={() => handleModeSelect('hitting')}>
                <CardContent className="py-8 flex flex-col items-center gap-2">
                  <span className="text-3xl">🏏</span>
                  <p className="font-semibold">Hitting</p>
                  <p className="text-xs text-muted-foreground text-center">Scenarios for hitters</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'setup' && (
          <SessionSetup mode={mode} onStart={handleSessionStart} />
        )}

        {step === 'scenario' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold capitalize">Build Scenario {current}</p>
              <Button onClick={handleRandomScenario} variant="outline" size="sm" className="gap-2">
                🎲 Random
              </Button>
            </div>
            <ScenarioBuilder mode={mode} onSubmit={handleScenarioReady} />
          </>
        )}

        {step === 'goal' && scenario && (
          <GoalPrompt mode={mode} scenario={scenario} onGoalSet={handleGoalSet} currentPlayer={currentPlayerLabel} />
        )}

        {step === 'result' && scenario && goal && (
          <>
            <ScenarioDisplay scenario={scenario} mode={mode} goal={goal} difficulties={session?.difficulties} infieldShift={session?.infieldShift} outfieldShift={session?.outfieldShift} lf={session?.lf} cf={session?.cf} rf={session?.rf} currentPlayer={currentPlayerLabel} />
            <p className="text-center font-semibold text-lg">Did you achieve your goal?</p>
            <p className="text-center text-sm text-muted-foreground">Goal: <span className="font-medium text-foreground">{goal.label}</span></p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Button onClick={() => handleResult(true)} className="h-16 text-base bg-green-600 hover:bg-green-700 text-white">
                ✅ Yes — Achieved
              </Button>
              <Button onClick={() => handleResult(false)} variant="outline" className="h-16 text-base border-red-400 text-red-600 hover:bg-red-50">
                ❌ No — Missed
              </Button>
            </div>
          </>
        )}

        {step === 'report' && (
          <ReportCard history={history} mode={mode} onRestart={() => { setHistory([]); handleSessionStart(session); }} onDone={resetAll} />
        )}
      </div>
    </div>
  );
}