import { buildStatsCanvas } from './buildStatsCanvas';

/**
 * Shares a stats image via the native share sheet (Android/iOS) or downloads it.
 *
 * Android-specific considerations:
 * - navigator.share() MUST be called synchronously within the user gesture (button click).
 *   Any async work (canvas, blob) must happen BEFORE the share call.
 * - navigator.canShare({files}) is not available in all Android browsers — we try anyway.
 * - If file-based sharing fails, we fall back to downloading the image.
 * - The download fallback uses a synchronous anchor click to avoid popup blockers.
 */
export function shareStatsImage({ game, pitcherName, pitches, atBats, label = null }) {
  if (!pitches || !atBats) {
    alert('Missing data — cannot share.');
    return;
  }

  // Build canvas and blob SYNCHRONOUSLY so navigator.share() can be called
  // in the same user-gesture tick (required by Android Chrome & Safari).
  let blob;
  try {
    const canvas = buildStatsCanvas(game, pitcherName, pitches, atBats, label);
    const dataURL = canvas.toDataURL('image/png');
    const b64 = dataURL.split(',')[1];
    if (!b64) throw new Error('Canvas to base64 failed');
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    blob = new Blob([arr], { type: 'image/png' });
  } catch (err) {
    alert('Could not build stats image: ' + err.message);
    return;
  }

  const safeName = (pitcherName || label || 'stats').replace(/\s+/g, '-').toLowerCase();
  const gameSlug = game
    ? `-vs-${(game.opponent || 'game').replace(/\s+/g, '-')}-${game.date || ''}`.toLowerCase()
    : '';
  const fileName = `${safeName}${gameSlug}.png`;

  // Try Web Share API with file (iOS 15+, Chrome Android 86+)
  // Called SYNCHRONOUSLY here — blob is already built above.
  if (typeof navigator !== 'undefined' && navigator.share) {
    const file = new File([blob], fileName, { type: 'image/png' });

    // canShare may not exist on older Android browsers — guard it
    const canShareFile = navigator.canShare
      ? navigator.canShare({ files: [file] })
      : true; // optimistic: try anyway

    if (canShareFile) {
      navigator
        .share({ files: [file], title: fileName, text: pitcherName || 'Game Stats' })
        .then(() => {
          // shared successfully
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            // AbortError = user dismissed, not a real error
            // Any other error: fall back to download
            downloadBlob(blob, fileName);
          }
        });
      return;
    }
  }

  // Fallback: direct download
  // This triggers immediately (same gesture tick) so Android won't block it.
  downloadBlob(blob, fileName);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Small delay before revoking so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}