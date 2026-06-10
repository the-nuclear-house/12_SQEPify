import jsPDF from 'jspdf';
import { LOGO_BASE64 } from './logoData';

/*
  TNH Upskilling Plan report. Same brand assets and palette as the portfolio PDF,
  but landscape so the development schedule has room. Drawn directly with jsPDF
  (no HTML-to-canvas): navy header band + logo, title block, AI summary, and a
  month-by-month roadmap with one lane per competency, a diamond per training and
  a gold target star showing the level each step reaches.
*/

type RGB = [number, number, number];
const NAVY: RGB = [15, 23, 42], CYAN: RGB = [6, 182, 212],
  LGREY: RGB = [148, 163, 184], MGREY: RGB = [85, 100, 120], BODY: RGB = [50, 60, 75],
  LINE: RGB = [222, 228, 236], GOLD: RGB = [200, 150, 30], GREEN: RGB = [110, 170, 60],
  CYAN_D: RGB = [6, 182, 212], DANGER: RGB = [207, 90, 10], FAINT: RGB = [120, 135, 150];

const LEVELS: Record<number, string> = { 0: 'Not assessed', 1: 'No knowledge', 2: 'Awareness', 3: 'Basic competence', 4: 'Full competence (SQEP)', 5: 'Expert' };

const PW = 297, PH = 210, MARGIN = 14, CW = PW - MARGIN * 2, HEADER_H = 24, FOOTER_H = 12;
const BODY_BOTTOM = PH - FOOTER_H;
const LANE_H = 18, LABEL_W = 60;

export interface PlanReportMeta {
  consultantName: string;
  jobTitle?: string | null;
  technicalDirector?: string | null;
  horizonMonths: number;
  date?: string;
  reference?: string;
}
export interface PlanReportStep {
  toLevel: number;
  month: number; // 1-based
  training: string;
  status: 'planned' | 'delivered' | 'assessed' | 'missing';
}
export interface PlanReportLane {
  name: string;
  steps: PlanReportStep[];
}
export interface ProfileAxis { axis: string; current: number; required: number }
export interface ProfileGap { name: string; current: number; required: number }
export interface PlanReportProfile {
  radar: ProfileAxis[];
  gaps: ProfileGap[];
  atRequired: number;
  total: number;
}

function wrap(doc: jsPDF, t: string, w: number): string[] { return t ? (doc.splitTextToSize(t, w) as string[]) : []; }

function starPath(cx: number, cy: number, rO: number, rI: number) {
  const p: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? rO : rI; const a = -Math.PI / 2 + i * Math.PI / 5; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return p;
}
function drawStar(doc: jsPDF, cx: number, cy: number, rO: number, rI: number, fill: RGB) {
  const p = starPath(cx, cy, rO, rI); const segs: [number, number][] = [];
  for (let i = 1; i < p.length; i++) segs.push([p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]]);
  doc.setFillColor(...fill); doc.lines(segs, p[0][0], p[0][1], [1, 1], 'F', true);
}
function drawDiamond(doc: jsPDF, cx: number, cy: number, r: number, opts: { fill?: RGB; dashed?: boolean; stroke?: RGB }) {
  const segs: [number, number][] = [[r, r], [-r, r], [-r, -r]];
  if (opts.dashed) {
    doc.setLineDashPattern([0.7, 0.7], 0); doc.setDrawColor(...(opts.stroke ?? DANGER)); doc.setLineWidth(0.5);
    doc.lines(segs, cx, cy - r, [1, 1], 'S', true); doc.setLineDashPattern([], 0);
  } else { doc.setFillColor(...(opts.fill ?? CYAN_D)); doc.lines(segs, cx, cy - r, [1, 1], 'F', true); }
}

function trunc(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function poly(doc: jsPDF, pts: [number, number][], style: string) {
  const segs: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  doc.lines(segs, pts[0][0], pts[0][1], [1, 1], style, true);
}

function drawRadar(doc: jsPDF, cx: number, cy: number, R: number, axes: ProfileAxis[]) {
  const N = axes.length;
  const pt = (i: number, level: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N; const r = (level / 5) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  doc.setDrawColor(...LINE); doc.setLineWidth(0.2);
  for (let g = 1; g <= 5; g++) poly(doc, axes.map((_, i) => pt(i, g)), 'S');
  axes.forEach((_, i) => { const [x, y] = pt(i, 5); doc.line(cx, cy, x, y); });
  doc.setLineDashPattern([0.8, 0.8], 0); doc.setDrawColor(...GOLD); doc.setLineWidth(0.7);
  poly(doc, axes.map((a, i) => pt(i, a.required)), 'S'); doc.setLineDashPattern([], 0);
  const cur = axes.map((a, i) => pt(i, a.current));
  try { doc.saveGraphicsState(); (doc as any).setGState(new (doc as any).GState({ opacity: 0.2 })); doc.setFillColor(...CYAN_D); poly(doc, cur, 'F'); doc.restoreGraphicsState(); } catch { /* opacity is best-effort */ }
  doc.setDrawColor(...CYAN_D); doc.setLineWidth(1.2); poly(doc, cur, 'S');
  cur.forEach(([x, y]) => { doc.setFillColor(...CYAN_D); doc.circle(x, y, 0.8, 'F'); });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MGREY);
  axes.forEach((a, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const lx = cx + (R + 5) * Math.cos(ang), ly = cy + (R + 5) * Math.sin(ang);
    const align = lx < cx - 2 ? 'right' : lx > cx + 2 ? 'left' : 'center';
    doc.text(trunc(a.axis, 18), lx, ly, { align: align as any });
  });
}

function header(doc: jsPDF, meta: PlanReportMeta) {
  doc.setFillColor(...NAVY); doc.rect(0, 0, PW, HEADER_H, 'F');
  doc.setFillColor(...CYAN); doc.rect(0, HEADER_H, PW, 1.1, 'F');
  try {
    const src = 'data:image/png;base64,' + LOGO_BASE64;
    const pr: any = (doc as any).getImageProperties(src);
    const h = 11, w = (pr.width / pr.height) * h;
    doc.addImage(src, 'PNG', MARGIN, (HEADER_H - h) / 2, w, h);
  } catch { /* logo is best-effort */ }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...LGREY);
  if (meta.reference) doc.text(meta.reference, PW - MARGIN, 10, { align: 'right' });
  if (meta.date) doc.text(meta.date, PW - MARGIN, 15, { align: 'right' });
}
function footer(doc: jsPDF, page: number) {
  const fy = PH - FOOTER_H; doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(MARGIN, fy, PW - MARGIN, fy);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MGREY);
  doc.text('The Nuclear House  ·  Commercial in confidence', MARGIN, fy + 5);
  doc.text('Page ' + page, PW - MARGIN, fy + 5, { align: 'right' });
}
function sectionHeading(doc: jsPDF, y: number, text: string): number {
  doc.setFillColor(...CYAN); doc.rect(MARGIN, y - 3.4, 2, 5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...NAVY);
  doc.text(text, MARGIN + 4, y); y += 3;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(MARGIN, y, PW - MARGIN, y);
  return y + 5;
}

export function generatePlanReportPDF(meta: PlanReportMeta, brief: string | null, profile: PlanReportProfile, lanes: PlanReportLane[]): jsPDF {
  const doc = new jsPDF('l', 'mm', 'a4');
  let page = 1; header(doc, meta); footer(doc, page);

  let y = HEADER_H + 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...NAVY);
  doc.text('Upskilling Plan', MARGIN, y); y += 7.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...MGREY);
  doc.text(meta.consultantName + (meta.jobTitle ? '  ·  ' + meta.jobTitle : ''), MARGIN, y); y += 5.5;
  doc.setFontSize(9); doc.setTextColor(...MGREY);
  const metaLine = [meta.technicalDirector ? ('Technical Director: ' + meta.technicalDirector) : null, 'Horizon: ' + meta.horizonMonths + ' months', meta.date ? ('Prepared ' + meta.date) : null].filter(Boolean).join('   ·   ');
  doc.text(metaLine, MARGIN, y); y += 3;
  doc.setFillColor(...CYAN); doc.rect(MARGIN, y, 28, 1.4, 'F'); y += 9;

  if (brief && brief.trim()) {
    y = sectionHeading(doc, y, 'Summary');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...BODY);
    wrap(doc, brief.trim(), CW).forEach((l) => { doc.text(l, MARGIN, y); y += 4.6; });
    y += 4;
  }

  // Competency profile: category radar (current vs required) plus the full gaps list.
  // Start on a fresh page if the radar wouldn't fit, so the chart is never clipped.
  if (y + 100 > BODY_BOTTOM) { doc.addPage(); page += 1; header(doc, meta); footer(doc, page); y = HEADER_H + 12; }
  y = sectionHeading(doc, y, 'Competency profile');
  const profTop = y;
  const TRACK: RGB = [233, 237, 242];
  const radarDrawn = profile.radar.length >= 3;
  if (radarDrawn) {
    const cx = MARGIN + 44, cy = profTop + 42, R = 34;
    drawRadar(doc, cx, cy, R, profile.radar);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MGREY);
    doc.setDrawColor(...CYAN_D); doc.setLineWidth(1.2); doc.line(MARGIN, cy + R + 16, MARGIN + 6, cy + R + 16);
    doc.text('Current', MARGIN + 8, cy + R + 17);
    doc.setLineDashPattern([0.8, 0.8], 0); doc.setDrawColor(...GOLD); doc.line(MARGIN + 30, cy + R + 16, MARGIN + 36, cy + R + 16); doc.setLineDashPattern([], 0);
    doc.text('Required', MARGIN + 38, cy + R + 17);
  }

  // One gap row (name + shortfall + level bar) at a given x/width.
  const gapRow = (g: ProfileGap, x: number, ry: number, w: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
    doc.text(trunc(g.name, Math.floor(w / 2.1)), x, ry);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MGREY);
    doc.text(`${LEVELS[g.current]} to ${LEVELS[g.required]}`, x + w, ry, { align: 'right' });
    const by = ry + 2.6, barH = 3.2;
    doc.setFillColor(...TRACK); doc.roundedRect(x, by, w, barH, 1, 1, 'F');
    const cw = Math.max(0, Math.min(1, g.current / 5)) * w;
    if (cw > 0) { doc.setFillColor(...CYAN_D); doc.roundedRect(x, by, cw, barH, 1, 1, 'F'); }
    const rx = x + Math.min(1, g.required / 5) * w;
    doc.setLineDashPattern([0.7, 0.7], 0); doc.setDrawColor(...GOLD); doc.setLineWidth(0.7);
    doc.line(rx, by - 1, rx, by + barH + 1); doc.setLineDashPattern([], 0);
  };

  // Heading + count + legend in the right column, beside the radar.
  const gx = radarDrawn ? MARGIN + 100 : MARGIN;
  const gw = PW - MARGIN - gx;
  let gy = profTop + 1;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text('Current levels and gaps', gx, gy); gy += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MGREY);
  doc.text(`${profile.atRequired} of ${profile.total} competencies are at the required level.`, gx, gy); gy += 6;
  doc.setFontSize(6.5);
  doc.setFillColor(...CYAN_D); doc.roundedRect(gx, gy - 2, 5, 2.4, 0.6, 0.6, 'F'); doc.text('Current level', gx + 7, gy);
  doc.setLineDashPattern([0.7, 0.7], 0); doc.setDrawColor(...GOLD); doc.line(gx + 36, gy - 2.4, gx + 36, gy + 0.6); doc.setLineDashPattern([], 0);
  doc.text('Required level', gx + 38, gy); gy += 6;

  if (profile.gaps.length === 0) {
    doc.setFontSize(9); doc.setTextColor(...GREEN); doc.text('No gaps remain against the required levels.', gx, gy); gy += 6;
  } else {
    // Keep all gaps in the right column on this single page; shrink the row pitch if there are many.
    const rowH = Math.max(7.5, Math.min(12.5, (BODY_BOTTOM - gy) / profile.gaps.length));
    profile.gaps.forEach((g) => { gapRow(g, gx, gy, gw); gy += rowH; });
  }

  // The schedule always starts flush at the top of the next page.
  doc.addPage(); page += 1; header(doc, meta); footer(doc, page); y = HEADER_H + 12;
  y = sectionHeading(doc, y, 'Development roadmap');
  const total = Math.max(meta.horizonMonths, 6, ...lanes.flatMap((l) => l.steps.map((s) => s.month)));
  const tlX = MARGIN + LABEL_W, tlW = PW - MARGIN - tlX;
  const posX = (m: number) => tlX + ((m - 0.5) / total) * tlW;

  const drawAxis = (ay: number, rows: number) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...FAINT);
    const every = total > 14 ? 2 : 1;
    for (let m = 1; m <= total; m++) {
      const x = posX(m);
      if ((m - 1) % every === 0) doc.text('M' + m, x, ay, { align: 'center' });
      doc.setDrawColor(238, 241, 245); doc.setLineWidth(0.2); doc.line(x, ay + 2, x, ay + 2 + rows * LANE_H);
    }
  };

  const rowsThatFit = () => Math.max(1, Math.floor((BODY_BOTTOM - (y + 4)) / LANE_H));
  let remaining = [...lanes];
  drawAxis(y, Math.min(remaining.length, rowsThatFit())); y += 4;

  while (remaining.length) {
    const fit = Math.max(1, Math.floor((BODY_BOTTOM - y) / LANE_H));
    const pageLanes = remaining.slice(0, fit);
    remaining = remaining.slice(fit);
    pageLanes.forEach((lane) => {
      const ly = y + LANE_H / 2;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
      wrap(doc, lane.name, LABEL_W - 4).slice(0, 3).forEach((l, i) => doc.text(l, MARGIN, y + 4 + i * 4));
      doc.setDrawColor(...LINE); doc.setLineWidth(0.4); doc.line(tlX, ly, PW - MARGIN, ly);
      if (lane.steps.length > 1) { const xs = lane.steps.map((s) => posX(s.month)); doc.setDrawColor(...CYAN); doc.setLineWidth(0.6); doc.line(Math.min(...xs), ly, Math.max(...xs), ly); }
      lane.steps.forEach((s) => {
        const x = posX(s.month);
        drawStar(doc, x, ly - 6.6, 2.7, 1.2, GOLD);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...NAVY); doc.text(String(s.toLevel), x, ly - 5.7, { align: 'center' });
        if (s.status === 'missing') drawDiamond(doc, x, ly, 2.1, { dashed: true, stroke: DANGER });
        else drawDiamond(doc, x, ly, 2.1, { fill: s.status === 'assessed' ? GREEN : CYAN_D });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...BODY);
        const tt = s.status === 'missing' ? 'Training to be defined' : s.training;
        wrap(doc, tt, 24).slice(0, 2).forEach((l, i) => doc.text(l, x, ly + 4.5 + i * 2.6, { align: 'center' }));
      });
      y += LANE_H;
    });
    if (remaining.length) { doc.addPage(); page += 1; header(doc, meta); footer(doc, page); y = HEADER_H + 12; y = sectionHeading(doc, y, 'Development roadmap (continued)'); drawAxis(y, Math.min(remaining.length, Math.floor((BODY_BOTTOM - (y + 4)) / LANE_H))); y += 4; }
  }

  // legend
  y += 4;
  if (y > BODY_BOTTOM - 6) { doc.addPage(); page += 1; header(doc, meta); footer(doc, page); y = HEADER_H + 12; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MGREY);
  drawStar(doc, MARGIN + 2, y - 1, 2.2, 1, GOLD); doc.text('Target level reached at this step', MARGIN + 6, y);
  drawDiamond(doc, MARGIN + 78, y - 1, 2, { fill: CYAN_D }); doc.text('Planned training', MARGIN + 82, y);
  drawDiamond(doc, MARGIN + 135, y - 1, 2, { dashed: true, stroke: DANGER }); doc.text('Training to be defined', MARGIN + 139, y);
  // mark unused-but-meaningful colour so linters keep it; level names used in callers

  return doc;
}
