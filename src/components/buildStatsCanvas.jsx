import { format } from 'date-fns';

const HIT_RESULTS = ['single','double','triple','home_run','bunt_single'];
const OUT_RESULTS = ['strikeout_swinging','strikeout_looking','groundout','flyout','lineout','popout','bunt_out','rbi_groundout','sac_fly','sac_bunt','fielders_choice','error','in_play_out'];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function buildStatsCanvas(game, pitcherName, pitches, atBats, label = null) {
  const W = 800;
  const PAD = 40;

  const ks    = atBats.filter(ab => ab.result?.includes('strikeout')).length;
  const bbs   = atBats.filter(ab => ab.result === 'walk' || ab.result === 'hbp').length;
  const hits  = atBats.filter(ab => HIT_RESULTS.includes(ab.result)).length;
  const hrs   = atBats.filter(ab => ab.result === 'home_run').length;
  const outs  = atBats.reduce((acc, ab) => {
    if (ab.result === 'double_play') return acc + 2;
    if (OUT_RESULTS.includes(ab.result)) return acc + 1;
    return acc;
  }, 0);
  const ipDisplay = `${Math.floor(outs / 3)}.${outs % 3}`;

  const ptMap = {};
  pitches.forEach(p => { if (p.pitch_type) ptMap[p.pitch_type] = (ptMap[p.pitch_type] || 0) + 1; });
  const pitchRows = Object.entries(ptMap).sort((a, b) => b[1] - a[1]);

  // Advanced stats
  const ipDecimal = Math.floor(outs / 3) + (outs % 3) / 3;
  const whip = ipDecimal > 0 ? ((bbs + hits) / ipDecimal).toFixed(2) : '—';
  const fip  = ipDecimal > 0 ? (((13 * hrs) + (3 * bbs) - (2 * ks)) / ipDecimal + 3.2).toFixed(2) : '—';

  const strikes = pitches.filter(p => ['called_strike','swinging_strike','foul','in_play_out','in_play_hit'].includes(p.result)).length;
  const swings  = pitches.filter(p => ['swinging_strike','foul','in_play_out','in_play_hit'].includes(p.result)).length;
  const whiffs  = pitches.filter(p => p.result === 'swinging_strike').length;
  const strikePct = pitches.length ? Math.round(strikes / pitches.length * 100) + '%' : '—';
  const whiffPct  = swings ? Math.round(whiffs / swings * 100) + '%' : '—';
  const kPct      = atBats.length ? Math.round(ks / atBats.length * 100) + '%' : '—';

  // Height calculation
  const headerH  = 90;
  const statsH   = 170; // two rows of stat boxes
  const advH     = 100;
  const arsenalH = pitchRows.length > 0 ? 50 + pitchRows.length * 38 : 0;
  const footerH  = 50;
  const H        = headerH + statsH + advH + arsenalH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header bar
  ctx.fillStyle = '#166534';
  ctx.fillRect(0, 0, W, headerH);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText((pitcherName || label || 'GAME SUMMARY').toUpperCase(), PAD, 42);

  ctx.fillStyle = '#86efac';
  ctx.font = '16px Arial, sans-serif';
  const subLine = game
    ? (() => { const dateStr = format(new Date(game.date), 'MMM d, yyyy'); return `vs ${game.opponent}  ·  ${dateStr}${game.location ? '  ·  ' + game.location : ''}`; })()
    : (label ? 'Career Stats' : '');
  ctx.fillText(subLine, PAD, 68);

  // Row 1: main stats (IP, PC, K, BB, H, BF)
  const row1 = [
    ['IP',  ipDisplay,      '#166534'],
    ['PC',  pitches.length, '#111111'],
    ['K',   ks,             '#166534'],
    ['BB',  bbs,            '#111111'],
    ['H',   hits,           '#dc2626'],
    ['BF',  atBats.length,  '#111111'],
  ];
  const boxW = (W - PAD * 2 - 10 * 5) / 6;
  let y = headerH + 16;

  row1.forEach(([label, val, color], i) => {
    const x = PAD + i * (boxW + 10);
    ctx.fillStyle = '#f3f4f6';
    roundRect(ctx, x, y, boxW, 72, 8);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(val), x + boxW / 2, y + 45);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText(label, x + boxW / 2, y + 63);
  });

  // Row 2: rate stats
  const row2 = [
    ['Strike%', strikePct],
    ['K%',      kPct],
    ['Whiff%',  whiffPct],
    ['WHIP',    whip],
    ['FIP',     fip],
  ];
  const boxW2 = (W - PAD * 2 - 10 * 4) / 5;
  y += 88;

  row2.forEach(([label, val], i) => {
    const x = PAD + i * (boxW2 + 10);
    ctx.fillStyle = '#f9fafb';
    roundRect(ctx, x, y, boxW2, 60, 8);
    ctx.fill();

    ctx.fillStyle = '#111111';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(val), x + boxW2 / 2, y + 36);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(label, x + boxW2 / 2, y + 52);
  });

  y += 76;

  // Pitch Arsenal
  if (pitchRows.length > 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PITCH ARSENAL', PAD, y);
    y += 20;

    // Divider
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 14;

    const labelW = 150;
    const countW = 90;
    const barW   = W - PAD * 2 - labelW - countW - 20;

    pitchRows.forEach(([type, count]) => {
      const pct = Math.round(count / pitches.length * 100);

      ctx.fillStyle = '#1f2937';
      ctx.font = '15px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(type.replace(/_/g, ' '), PAD, y + 18);

      // Bar bg
      ctx.fillStyle = '#e5e7eb';
      roundRect(ctx, PAD + labelW, y + 4, barW, 14, 4);
      ctx.fill();

      // Bar fill
      ctx.fillStyle = '#16a34a';
      roundRect(ctx, PAD + labelW, y + 4, Math.max(4, barW * pct / 100), 14, 4);
      ctx.fill();

      ctx.fillStyle = '#6b7280';
      ctx.font = '13px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${count} (${pct}%)`, W - PAD, y + 18);

      y += 38;
    });
  }

  // Footer
  y = H - 30;
  ctx.fillStyle = '#d1d5db';
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Scout App  ·  Baseball Stats', W / 2, y);

  return canvas;
}