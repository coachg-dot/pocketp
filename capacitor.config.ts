import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.guptelpa.pocketpitcher',
  appName: 'Pocket Pitcher',
  webDir: 'dist',
  server: {
    url: 'https://pocketpitcher26.base44.app/Home',
    cleartext: false
  }
};

export default config;
