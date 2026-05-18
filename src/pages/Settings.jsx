import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, LogOut, Trash2, ChevronRight, Info, Upload, AlertTriangle, RefreshCw, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me()
  });

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleClearData = async () => {
    setClearing(true);
    setClearResult(null);
    const res = await base44.functions.invoke('clearMyData', {});
    setClearing(false);
    setClearResult(res.data?.deleted || null);
  };

  const handleRequestDeletion = () => {
    const email = user?.email || '';
    const subject = encodeURIComponent('Delete My Account');
    const body = encodeURIComponent(
      `Hello,\n\nI would like to request deletion of my PocketPitcher account and all associated data.\n\nAccount email:\n${email}\n\nThank you.`
    );
    window.open(`mailto:delete@pocketpitcher.shop?subject=${subject}&body=${body}`, '_blank');
    setRequestSent(true);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-primary text-primary-foreground px-4 pt-safe py-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Account */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Account</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{user?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
              </div>
            </div>
            <Separator />
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors select-none touch-target"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Sign Out</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Data</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Link
              to="/ImportRosters"
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors select-none touch-target"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Import Teams / Rosters</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">App</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <a
              href="https://media.base44.com/files/public/69a909949d2b9a4460f5c62c/3964c45e1_Pocket_Pitcher_User_Guide.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors select-none touch-target"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">User Guide</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </a>
            <Separator />
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Version</span>
              </div>
              <span className="text-sm text-muted-foreground">1.0.1</span>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive uppercase tracking-wide">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => { setClearDataDialogOpen(true); setClearResult(null); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear All Data
            </Button>
            <Button variant="destructive" className="w-full" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Clear Data Confirmation Dialog */}
      <Dialog open={clearDataDialogOpen} onOpenChange={(open) => { setClearDataDialogOpen(open); if (!open) { setClearResult(null); } }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Clear All Data
            </DialogTitle>
          </DialogHeader>
          {clearResult ? (
            <div className="space-y-4 pt-1">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-1 text-sm">
                <p className="font-semibold text-green-500">Data cleared successfully.</p>
                <p className="text-muted-foreground text-xs">{clearResult.teams} teams · {clearResult.teamPlayers} players · {clearResult.teamPitchers} pitchers · {clearResult.games} games · {clearResult.pitches} pitches · {clearResult.atBats} at-bats deleted</p>
              </div>
              <Button className="w-full h-11" onClick={() => setClearDataDialogOpen(false)}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This will permanently delete all your teams, rosters, games, pitches, and stats. This cannot be undone.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  className="w-full h-11"
                  disabled={clearing}
                  onClick={handleClearData}
                >
                  {clearing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Clearing…</> : <><Trash2 className="w-4 h-4 mr-2" /> Yes, Delete Everything</>}
                </Button>
                <Button variant="outline" className="w-full h-11" onClick={() => setClearDataDialogOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setRequestSent(false); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
          </DialogHeader>
          {requestSent ? (
            <div className="space-y-4 pt-1">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-sm text-green-400 leading-relaxed">
                  Your account deletion request has been started. Please send the email to complete your request.
                </p>
              </div>
              <Button className="w-full h-11" onClick={() => { setDeleteDialogOpen(false); setRequestSent(false); }}>
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to delete your PocketPitcher account? This action is permanent and cannot be undone. Your account and associated data will be deleted.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  className="w-full h-11"
                  onClick={handleRequestDeletion}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Request Account Deletion
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}