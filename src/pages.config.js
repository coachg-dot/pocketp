/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import RosterManager from './pages/RosterManager';
import BullpenManager from './pages/BullpenManager';
import ImportStats from './pages/ImportStats';
import ImportRosters from './pages/ImportRosters';
import Home from './pages/Home';
import NewGame from './pages/NewGame';
import PitchSequencing from './pages/PitchSequencing';
import Players from './pages/Players';
import Practice from './pages/Practice';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Stats from './pages/Stats';
import TrackGame from './pages/TrackGame';
import GameSummaryDashboard from './pages/GameSummaryDashboard';
import ScoutingDashboard from './pages/ScoutingDashboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analytics": Analytics,
    "Dashboard": Dashboard,
    "BullpenManager": BullpenManager,
    "GameSummaryDashboard": GameSummaryDashboard,
    "ImportStats": ImportStats,
    "ImportRosters": ImportRosters,
    "Home": Home,
    "NewGame": NewGame,
    "PitchSequencing": PitchSequencing,
    "Players": Players,
    "RosterManager": RosterManager,
    "Practice": Practice,
    "Schedule": Schedule,
    "Settings": Settings,
    "Stats": Stats,
    "TrackGame": TrackGame,
    "ScoutingDashboard": ScoutingDashboard,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};