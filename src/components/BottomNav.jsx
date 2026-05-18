import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, CalendarDays, Users, TrendingUp, Shield, Settings } from 'lucide-react';

const TABS = [
  { label: 'Home',      icon: Home,         page: 'Home' },
  { label: 'Analytics', icon: TrendingUp,   page: 'Analytics' },
  { label: 'Scout',     icon: Shield,       page: 'ScoutingDashboard' },
  { label: 'Roster',    icon: Users,        page: 'Players' },
  { label: 'Settings',  icon: Settings,     page: 'Settings' },
];

// Pages where we DON'T show the bottom nav
const HIDE_ON = ['TrackGame', 'NewGame', 'PitchSequencing', 'BullpenManager'];

export default function BottomNav({ currentPageName }) {
  const navigate = useNavigate();

  if (HIDE_ON.includes(currentPageName)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-stretch max-w-lg mx-auto">
        {TABS.map(({ label, icon: Icon, page }) => {
          const active = currentPageName === page;
          return (
            <button
              key={page}
              onClick={() => {
                if (active) {
                  navigate(createPageUrl(page), { replace: true });
                } else {
                  navigate(createPageUrl(page));
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 select-none touch-target transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}