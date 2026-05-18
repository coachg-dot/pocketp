import React from 'react';
import { motion } from 'framer-motion';
import BottomNav from './components/BottomNav';
import ThemeProvider from './components/ThemeProvider';

// Bottom-nav tab pages — keep mounted to preserve scroll & state
const TAB_PAGES = new Set(['Home', 'Stats', 'Schedule', 'Players', 'Settings', 'Analytics', 'Practice']);

// Detail pages slide in from the right
const DETAIL_PAGES = new Set(['TrackGame', 'NewGame', 'PitchSequencing']);

const slideVariants = {
  initial: { opacity: 0, x: 40 },
  in:      { opacity: 1, x: 0 },
  out:     { opacity: 0, x: -20 },
};

const fadeVariants = {
  initial: { opacity: 0 },
  in:      { opacity: 1 },
  out:     { opacity: 0 },
};

const transition = { type: 'tween', ease: 'easeInOut', duration: 0.18 };

// Per-page background image map
const PAGE_BACKGROUNDS = {
  // Home → Core Hero Background
  Home: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/85623266b_generated_image.png',
  // TrackGame / NewGame → Pitch Velocity + Game Simulation
  TrackGame: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/faef8891b_generated_image.png',
  NewGame: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/faef8891b_generated_image.png',
  // Analytics / Stats → Data Analytics Field View
  Analytics: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/cc200709e_generated_image.png',
  Stats: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/cc200709e_generated_image.png',
  // PitchSequencing → Strike Zone + Algorithm
  PitchSequencing: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/5cd1e6a81_generated_image.png',
  // Players / RosterManager / Schedule → Minimal Ambient
  Players: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/994aca7df_generated_image.png',
  RosterManager: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/994aca7df_generated_image.png',
  Schedule: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/994aca7df_generated_image.png',
  // Practice / ImportStats / ImportRosters → Training Theme
  Practice: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/88c0a6b7c_generated_image.png',
  ImportStats: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/88c0a6b7c_generated_image.png',
  ImportRosters: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/88c0a6b7c_generated_image.png',
  // Settings → Pitch Selection Interface Style
  Settings: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/76e3d9c1f_generated_image.png',
  // ScoutingDashboard → Data Analytics Field View (same as Stats/Analytics)
  ScoutingDashboard: 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/cc200709e_generated_image.png',
};

// Fallback background (spin rate / rotation)
const DEFAULT_BG = 'https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/a22084a3b_generated_image.png';

export default function Layout({ children, currentPageName }) {
  const isDetail = DETAIL_PAGES.has(currentPageName);
  const showBottomNav = !DETAIL_PAGES.has(currentPageName);

  const bgUrl = PAGE_BACKGROUNDS[currentPageName] || DEFAULT_BG;
  const BG_IMAGE = `url('${bgUrl}')`;

  return (
    <div
      className="relative overflow-x-hidden min-h-screen"
      style={{
        backgroundImage: BG_IMAGE,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Dark overlay to keep content readable */}
      <div className="fixed inset-0 bg-black/75 -z-10 pointer-events-none" />
      {/* Subtle logo watermark bottom-right */}
      <div
        className="fixed bottom-16 right-0 w-40 h-40 opacity-[0.06] pointer-events-none -z-10"
        style={{
          backgroundImage: `url('https://media.base44.com/images/public/69a909949d2b9a4460f5c62c/b9e22aa14_ChatGPTImageMar14202609_53_06PM.png')`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right bottom',
        }}
      />
      <ThemeProvider />

      <motion.div
        key={currentPageName}
        initial="initial"
        animate="in"
        exit="out"
        variants={isDetail ? slideVariants : fadeVariants}
        transition={transition}
        className={showBottomNav ? 'pb-safe-nav' : ''}
      >
        {children}
      </motion.div>

      <BottomNav currentPageName={currentPageName} />
    </div>
  );
}