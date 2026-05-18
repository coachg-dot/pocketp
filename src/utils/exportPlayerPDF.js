import { jsPDF } from 'jspdf';

const BRAND_GREEN  = [22, 101, 52];   // #166534
const BRAND_LIGHT  = [134, 239, 172]; // #86efac
const GRAY_DARK    = [31, 41, 55];
const GRAY_MID     = [107, 114, 128];
const GRAY_LIGHT   = [243, 244, 246];
const RED          = [220, 38, 38];
const BLUE         = [37, 99, 235];

function fmtAvg(val) { return val != null ? `.${(val * 1000).toFixed(0).padStart(3, '0')}` : '---'; }
function fmtPct(val) { return val != null ? `${(val * 100).toFixed(1)}%` : '---'; }
function fmtDec(val, d = 2) { return val != null ? val.toFixed(d) : '---'; }
function fmtInt(val) { return val != null ? String(val) : '0'; }

function setFill(doc, [r, g, b]) { doc.setFillColor(r, g, b); }
function setTextColor(doc, [r, g, b]) { doc.setTextColor(r, g, b); }

function drawRoundRect(doc, x, y, w, h, r = 3) {
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

function statBox(doc, x, y, w, h, label, value, highlight = false, valueColor = GRAY_DARK) {
  setFill(doc, highlight ? [220, 252, 231] : GRAY_LIGHT);
  drawRoundRect(doc, x, y, w, h);
  setTextColor(doc, valueColor);
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(String(value), x + w / 2, y + h / 2 - 0.5, { align: 'center', baseline: 'middle' });
  setTextColor(doc, GRAY_MID);
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.text(label, x + w / 2, y + h - 3, { align: 'center' });
}

function sectionTitle(doc, x, y, title) {
  setTextColor(doc, GRAY_MID);
  doc.setFontSize(7.5);
  doc.setFont(undefined, 'bold');
  doc.text(title.toUpperCase(), x, y);
  doc.setDrawColor(...GRAY_MID);
  doc.setLineWidth(0.3);
  doc.line(x + doc.getTextWidth(title.toUpperCase()) + 3, y - 1, 195, y - 1);
}

export function exportPlayerCardPDF(player) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const PAD = 15;
  const contentW = pageW - PAD * 2;

  // ── Header bar ──────────────────────────────────────────────
  setFill(doc, BRAND_GREEN);
  doc.rect(0, 0, pageW, 38, 'F');

  // Accent stripe
  setFill(doc, [20, 83, 45]);
  doc.rect(0, 34, pageW, 4, 'F');

  // Player name
  setTextColor(doc, [255, 255, 255]);
  doc.setFontSize(22);
  doc.setFont(undefined, 'bold');
  doc.text((player.name || 'PLAYER').toUpperCase(), PAD, 18);

  // Position / handedness badge
  const posBadge = [player.position, player.bats ? `Bats ${player.bats}` : null].filter(Boolean).join('  ·  ');
  if (posBadge) {
    setTextColor(doc, BRAND_LIGHT);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(posBadge, PAD, 27);
  }

  // Branding top-right
  setTextColor(doc, [134, 239, 172]);
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.text('POCKET PITCHER \'27', pageW - PAD, 15, { align: 'right' });
  setTextColor(doc, [134, 239, 172]);
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.text('Player Career Stats', pageW - PAD, 22, { align: 'right' });

  let y = 48;

  // ── Hero stats row (AVG / OBP / SLG / OPS) ──────────────────
  const heroStats = [
    { label: 'AVG', value: fmtAvg(player.avg), color: BRAND_GREEN },
    { label: 'OBP', value: fmtAvg(player.obp), color: BLUE },
    { label: 'SLG', value: fmtAvg(player.slg), color: BLUE },
    { label: 'OPS', value: fmtAvg(player.ops), color: GRAY_DARK },
  ];
  const heroW = (contentW - 9) / 4;
  heroStats.forEach(({ label, value, color }, i) => {
    const x = PAD + i * (heroW + 3);
    setFill(doc, i === 0 ? [220, 252, 231] : GRAY_LIGHT);
    drawRoundRect(doc, x, y, heroW, 18, 3);
    setTextColor(doc, color);
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.text(value, x + heroW / 2, y + 10, { align: 'center', baseline: 'middle' });
    setTextColor(doc, GRAY_MID);
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text(label, x + heroW / 2, y + 16, { align: 'center' });
  });

  y += 24;

  // ── Traditional counting stats ───────────────────────────────
  sectionTitle(doc, PAD, y, 'Counting Stats');
  y += 5;

  const countStats = [
    { label: 'PA',  value: fmtInt(player.pa) },
    { label: 'AB',  value: fmtInt(player.atBats) },
    { label: 'H',   value: fmtInt(player.hits) },
    { label: '2B',  value: fmtInt(player.doubles) },
    { label: '3B',  value: fmtInt(player.triples) },
    { label: 'HR',  value: fmtInt(player.homeRuns), color: RED },
    { label: 'RBI', value: fmtInt(player.rbis) },
    { label: 'BB',  value: fmtInt(player.walks) },
    { label: 'K',   value: fmtInt(player.strikeouts), color: RED },
    { label: 'TB',  value: fmtInt(player.totalBases) },
  ];
  const csW = (contentW - 9 * 2) / 10;
  countStats.forEach(({ label, value, color }, i) => {
    statBox(doc, PAD + i * (csW + 2), y, csW, 14, label, value, false, color || GRAY_DARK);
  });

  y += 20;

  // ── Rate / Sabermetrics ──────────────────────────────────────
  sectionTitle(doc, PAD, y, 'Rate Stats & Sabermetrics');
  y += 5;

  const rateStats = [
    { label: 'RISP',  value: fmtAvg(player.risp), hl: true },
    { label: 'ISO',   value: fmtAvg(player.iso) },
    { label: 'BABIP', value: fmtAvg(player.babip) },
    { label: 'OPS+',  value: player.ops_plus != null ? Math.round(player.ops_plus).toString() : '---', hl: player.ops_plus != null && player.ops_plus >= 100 },
    { label: 'BB%',   value: fmtPct(player.bb_pct) },
    { label: 'K%',    value: fmtPct(player.k_pct) },
    { label: 'BB/K',  value: fmtDec(player.bb_k) },
  ];
  const rsW = (contentW - 6 * 2) / 7;
  rateStats.forEach(({ label, value, hl }, i) => {
    statBox(doc, PAD + i * (rsW + 2), y, rsW, 14, label, value, hl);
  });

  y += 20;

  // ── Contact quality ──────────────────────────────────────────
  sectionTitle(doc, PAD, y, 'Contact Quality');
  y += 5;

  const contactStats = [
    { label: 'HardH%', value: fmtPct(player.hard_contact) },
    { label: 'GB%',    value: fmtPct(player.gb_pct) },
    { label: 'FB%',    value: fmtPct(player.fb_pct) },
  ];
  const cqW = (contentW - 2 * 2) / 3;
  contactStats.forEach(({ label, value }, i) => {
    statBox(doc, PAD + i * (cqW + 2), y, cqW, 14, label, value);
  });

  y += 20;

  // ── AVG / OBP / SLG visual bar chart ─────────────────────────
  sectionTitle(doc, PAD, y, 'Slash Line Visual');
  y += 6;

  const slashStats = [
    { label: 'AVG', val: player.avg || 0, max: 0.5, color: BRAND_GREEN },
    { label: 'OBP', val: player.obp || 0, max: 0.6, color: BLUE },
    { label: 'SLG', val: player.slg || 0, max: 0.9, color: [168, 85, 247] },
  ];
  const barTrackW = contentW - 20;
  slashStats.forEach(({ label, val, max, color }) => {
    setTextColor(doc, GRAY_DARK);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text(label, PAD, y + 4);

    // Track
    setFill(doc, GRAY_LIGHT);
    doc.rect(PAD + 14, y, barTrackW, 5, 'F');
    // Fill
    setFill(doc, color);
    doc.rect(PAD + 14, y, Math.max(0, Math.min(barTrackW * val / max, barTrackW)), 5, 'F');
    // Value label
    setTextColor(doc, GRAY_MID);
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text(fmtAvg(val), pageW - PAD, y + 4, { align: 'right' });

    y += 9;
  });

  y += 4;

  // ── Footer ───────────────────────────────────────────────────
  const footerY = 285;
  setFill(doc, BRAND_GREEN);
  doc.rect(0, footerY, pageW, 12, 'F');
  setTextColor(doc, [134, 239, 172]);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Pocket Pitcher \'27  ·  Baseball Stats & Analytics', PAD, footerY + 7.5);
  doc.text(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), pageW - PAD, footerY + 7.5, { align: 'right' });

  const safeName = (player.name || 'player').replace(/[^a-z0-9]/gi, '_');
  doc.save(`${safeName}_career_stats.pdf`);
}