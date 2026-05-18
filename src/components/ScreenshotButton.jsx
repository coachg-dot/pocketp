import React, { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Captures a DOM element as a PNG image and opens the native share sheet.
 *
 * Android fix: We must call navigator.share() synchronously within the user
 * gesture. Dynamic import (await import()) breaks this on Android Chrome because
 * it introduces an async gap before navigator.share() is called, which causes
 * Android to block the share sheet as a popup.
 *
 * Solution: Use a pre-loaded html2canvas (imported at module level) so the
 * share call happens synchronously after the canvas is ready.
 */

// Pre-load html2canvas at module level so it's ready when the user taps Share
let html2canvasModule = null;
import('html2canvas').then(m => { html2canvasModule = m.default; });

export default function ScreenshotButton({ targetRef, filename = 'stats', className = '', size = 'icon' }) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (!targetRef?.current) return;
    if (loading) return;
    setLoading(true);

    try {
      // Ensure html2canvas is loaded
      if (!html2canvasModule) {
        html2canvasModule = (await import('html2canvas')).default;
      }

      const canvas = await html2canvasModule(targetRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Convert to blob synchronously BEFORE calling share
      const dataURL = canvas.toDataURL('image/png');
      const b64 = dataURL.split(',')[1];
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: 'image/png' });
      const fname = `${filename}.png`;
      const file = new File([blob], fname, { type: 'image/png' });

      // Try Web Share API — works on iOS and Android Chrome 86+
      // navigator.share MUST be called directly after synchronous blob creation
      if (navigator.share) {
        const shareData = { files: [file], title: filename };
        // canShare may not exist on all Android browsers — guard it
        const ok = navigator.canShare ? navigator.canShare(shareData) : true;
        if (ok) {
          try {
            await navigator.share(shareData);
            setLoading(false);
            return;
          } catch (err) {
            if (err.name === 'AbortError') {
              // User dismissed — not an error
              setLoading(false);
              return;
            }
            // Fall through to download
          }
        }
      }

      // Fallback: trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

    } catch (err) {
      alert('Could not capture image: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      className={`text-muted-foreground hover:text-foreground ${className}`}
      onClick={handleShare}
      disabled={loading}
      title="Share as image"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
    </Button>
  );
}