/**
 * Retro 1-bit Pixel Art Collage Generator (400 x 140 virtual pixel grid)
 * Renders authentic 90s OS error/virus dialogs, dithered skull, progress bars,
 * and pixel toolbars in pure #000000, #0047FF, and #FFFFFF.
 */

// Compact 3x5 pixel bitmap font for razor-sharp 1-bit typography
const FONT_3X5 = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '110'],
  '.': ['000', '000', '000', '000', '010'],
  ':': ['000', '010', '000', '010', '000'],
  '!': ['010', '010', '010', '000', '010'],
  '-': ['000', '000', '111', '000', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '>': ['100', '010', '001', '010', '100'],
  '"': ['101', '101', '000', '000', '000'],
  ' ': ['000', '000', '000', '000', '000'],
};

const BLACK = '#000000';
const BLUE = '#0047FF';
const WHITE = '#FFFFFF';

function px(ctx, x, y, w = 1, h = 1, color = WHITE) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function drawText(ctx, text, x, y, color = WHITE, scale = 1) {
  const upper = text.toUpperCase();
  let cx = Math.floor(x);
  const cy = Math.floor(y);
  ctx.fillStyle = color;

  for (let i = 0; i < upper.length; i++) {
    const glyph = FONT_3X5[upper[i]] || FONT_3X5[' '];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (glyph[r][c] === '1') {
          ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
        }
      }
    }
    cx += 4 * scale;
  }
}

function drawRectOutline(ctx, x, y, w, h, fill, border, thickness = 1) {
  px(ctx, x, y, w, h, fill);
  px(ctx, x, y, w, thickness, border); // top
  px(ctx, x, y + h - thickness, w, thickness, border); // bottom
  px(ctx, x, y, thickness, h, border); // left
  px(ctx, x + w - thickness, y, thickness, h, border); // right
}

function drawWindow(ctx, x, y, w, h, title, theme = 'blue') {
  const isBlue = theme === 'blue';
  const isLight = theme === 'light';
  const bg = isLight ? WHITE : isBlue ? BLUE : BLACK;
  const fg = isLight ? BLACK : WHITE;
  const border = isLight ? BLACK : WHITE;
  const titleBg = isLight ? BLACK : WHITE;
  const titleFg = isLight ? WHITE : isBlue ? BLUE : BLACK;

  // Hard drop shadow
  px(ctx, x + 2, y + 2, w, h, BLACK);
  // Main frame
  drawRectOutline(ctx, x, y, w, h, bg, border, 1);
  // Title bar
  px(ctx, x + 1, y + 1, w - 2, 7, titleBg);
  drawText(ctx, title, x + 3, y + 2, titleFg, 1);

  // [X] close button on right of title bar
  const bx = x + w - 7;
  const by = y + 2;
  px(ctx, bx, by, 5, 5, isLight ? WHITE : bg);
  px(ctx, bx + 1, by + 1, 1, 1, fg);
  px(ctx, bx + 3, by + 1, 1, 1, fg);
  px(ctx, bx + 2, by + 2, 1, 1, fg);
  px(ctx, bx + 1, by + 3, 1, 1, fg);
  px(ctx, bx + 3, by + 3, 1, 1, fg);
}

function drawButton(ctx, x, y, label, theme = 'dark') {
  const w = label.length * 4 + 5;
  const h = 9;
  const bg = theme === 'light' ? WHITE : theme === 'blue' ? BLUE : BLACK;
  const fg = theme === 'light' ? BLACK : WHITE;
  const border = theme === 'light' ? BLACK : WHITE;
  drawRectOutline(ctx, x, y, w, h, bg, border, 1);
  drawText(ctx, label, x + 3, y + 2, fg, 1);
}

function drawCircleX(ctx, cx, cy, r, bg = WHITE, fg = BLUE) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        px(ctx, cx + dx, cy + dy, 1, 1, bg);
      }
    }
  }
  for (let i = -2; i <= 2; i++) {
    px(ctx, cx + i, cy + i, 1, 1, fg);
    px(ctx, cx + i, cy - i, 1, 1, fg);
  }
}

function drawWarningTriangle(ctx, cx, cy) {
  for (let row = 0; row < 11; row++) {
    const half = Math.floor(row * 0.75);
    for (let dx = -half; dx <= half; dx++) {
      const isBorder = row === 10 || Math.abs(dx) >= half - 1;
      px(ctx, cx + dx, cy + row, 1, 1, isBorder ? WHITE : BLACK);
    }
  }
  // Exclamation mark
  px(ctx, cx, cy + 4, 1, 3, WHITE);
  px(ctx, cx, cy + 8, 1, 1, WHITE);
}

function drawDitheredSkull(ctx, ox, oy) {
  // 34 x 36 iconic 1-bit Bayer-dithered pixel skull
  const w = 34;
  const h = 36;
  const bayer = [
    [0, 2],
    [3, 1],
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / (w / 2);
      const ny = (y - 14) / 14;
      const dist = nx * nx + ny * ny;

      // Cranium + jaw silhouette
      const inCranium = dist <= 0.92 && y < 25;
      const inCheek = y >= 18 && y < 26 && Math.abs(x - 17) < 12;
      const inJaw = y >= 25 && y < 34 && Math.abs(x - 17) < 8 - Math.floor((y - 25) * 0.25);

      if (!inCranium && !inCheek && !inJaw) continue;

      // Left eye socket
      const leDist = Math.pow(x - 11, 2) + Math.pow(y - 17, 2);
      // Right eye socket (larger with X)
      const reDist = Math.pow(x - 23, 2) + Math.pow(y - 17, 2);
      // Nose cavity
      const inNose = y >= 21 && y <= 25 && Math.abs(x - 17) <= (y - 20) * 0.6;
      // Teeth gaps
      const inTeethGap = y >= 29 && y <= 33 && (x === 13 || x === 17 || x === 21 || y === 31);

      if (leDist <= 14 || reDist <= 16 || inNose || inTeethGap) {
        px(ctx, ox + x, oy + y, 1, 1, BLUE);
        continue;
      }

      // Shading with 1-bit dither on right/bottom edges
      const shade = (nx * 0.45 + ny * 0.35 + 0.55);
      const thresh = bayer[y % 2][x % 2] / 4;
      px(ctx, ox + x, oy + y, 1, 1, shade < 0.85 || thresh > 0.35 ? WHITE : BLUE);
    }
  }

  // Pixel X inside right eye socket
  for (let i = -2; i <= 2; i++) {
    px(ctx, ox + 23 + i, oy + 17 + i, 1, 1, WHITE);
    px(ctx, ox + 23 + i, oy + 17 - i, 1, 1, WHITE);
  }
}

function drawSmileyBox(ctx, x, y) {
  // Selection bounding box with corner handles
  drawRectOutline(ctx, x, y, 22, 22, BLACK, WHITE, 1);
  px(ctx, x - 1, y - 1, 3, 3, WHITE);
  px(ctx, x + 20, y - 1, 3, 3, WHITE);
  px(ctx, x - 1, y + 20, 3, 3, WHITE);
  px(ctx, x + 20, y + 20, 3, 3, WHITE);

  // Smiley circle
  const cx = x + 11;
  const cy = y + 11;
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      const d = dx * dx + dy * dy;
      if (d <= 64 && d >= 44) px(ctx, cx + dx, cy + dy, 1, 1, WHITE);
    }
  }
  // Eyes
  px(ctx, cx - 3, cy - 3, 2, 3, WHITE);
  px(ctx, cx + 2, cy - 3, 2, 3, WHITE);
  // Smile arc
  for (let dx = -4; dx <= 4; dx++) {
    const sy = Math.floor(4 - (dx * dx) * 0.14);
    px(ctx, cx + dx, cy + sy, 1, 1, WHITE);
  }

  // Pixel pointer cursor at bottom-right corner
  const pxX = x + 18;
  const pxY = y + 18;
  const arrow = [
    '100000',
    '110000',
    '121000',
    '122100',
    '122210',
    '122111',
    '121000',
    '101100',
    '000110',
  ];
  for (let r = 0; r < arrow.length; r++) {
    for (let c = 0; c < arrow[r].length; c++) {
      if (arrow[r][c] === '1') px(ctx, pxX + c, pxY + r, 1, 1, BLACK);
      if (arrow[r][c] === '2') px(ctx, pxX + c, pxY + r, 1, 1, WHITE);
    }
  }
}

function drawHourglass(ctx, x, y) {
  const hg = [
    '1111111',
    '0122210',
    '0012100',
    '0001000',
    '0010100',
    '0102010',
    '1111111',
  ];
  for (let r = 0; r < hg.length; r++) {
    for (let c = 0; c < hg[r].length; c++) {
      if (hg[r][c] === '1') px(ctx, x + c, y + r, 1, 1, WHITE);
      if (hg[r][c] === '2') px(ctx, x + c, y + r, 1, 1, BLUE);
    }
  }
}

function drawToolbarPalette(ctx, x, y) {
  drawWindow(ctx, x, y, 26, 78, '', 'dark');
  const cols = [x + 3, x + 14];
  for (let row = 0; row < 6; row++) {
    const ty = y + 10 + row * 11;
    drawRectOutline(ctx, cols[0], ty, 9, 9, BLACK, WHITE, 1);
    drawRectOutline(ctx, cols[1], ty, 9, 9, BLACK, WHITE, 1);
  }
  // Tiny tool glyphs inside boxes
  // Row 0: Star & Dashed select
  px(ctx, cols[0] + 4, y + 12, 1, 5, WHITE);
  px(ctx, cols[0] + 2, y + 14, 5, 1, WHITE);
  px(ctx, cols[1] + 2, y + 12, 5, 1, WHITE);
  px(ctx, cols[1] + 2, y + 16, 5, 1, WHITE);
  // Row 1: Eraser & Flag
  px(ctx, cols[0] + 2, y + 24, 5, 3, WHITE);
  px(ctx, cols[1] + 2, y + 23, 4, 3, BLUE);
  px(ctx, cols[1] + 2, y + 23, 1, 5, WHITE);
  // Row 2: Magnifier & Pencil
  drawRectOutline(ctx, cols[0] + 2, y + 34, 4, 4, BLACK, WHITE, 1);
  px(ctx, cols[0] + 6, y + 38, 1, 1, WHITE);
  px(ctx, cols[1] + 3, y + 34, 3, 5, WHITE);
  // Row 3: Bucket & 'A'
  px(ctx, cols[0] + 2, y + 46, 4, 4, BLUE);
  drawText(ctx, 'A', cols[1] + 3, y + 45, WHITE, 1);
  // Row 4: Line & Curve
  for (let i = 0; i < 5; i++) px(ctx, cols[0] + 2 + i, y + 56 + i, 1, 1, WHITE);
  px(ctx, cols[1] + 3, y + 56, 3, 1, WHITE);
  px(ctx, cols[1] + 2, y + 58, 3, 1, WHITE);
  px(ctx, cols[1] + 3, y + 60, 3, 1, WHITE);
  // Row 5: Rect & Oval
  drawRectOutline(ctx, cols[0] + 2, y + 67, 5, 4, BLACK, WHITE, 1);
  drawRectOutline(ctx, cols[1] + 2, y + 67, 5, 4, BLUE, WHITE, 1);
}

/**
 * Generates an ImageData buffer of size (400 x 140) containing the complete
 * retro cyber-error pixel collage.
 */
export function buildRetroCollageBuffer() {
  const W = 400;
  const H = 140;
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const ctx = off.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // 1. Pitch-black base with subtle 1px dither grid stars
  px(ctx, 0, 0, W, H, BLACK);
  for (let y = 4; y < H; y += 12) {
    for (let x = 6; x < W; x += 18) {
      px(ctx, x, y, 1, 1, (x + y) % 5 === 0 ? BLUE : '#1A2B55');
    }
  }

  // 2. ZONE 1 (Left: x 0..168, visible below y ~ 53)
  drawWindow(ctx, 18, 56, 78, 34, 'ERROR', 'blue');
  drawCircleX(ctx, 28, 71, 4, WHITE, BLUE);
  drawText(ctx, 'SPOOFED', 36, 68, WHITE, 1);
  drawButton(ctx, 24, 78, 'RETRY', 'blue');
  drawButton(ctx, 56, 78, 'CANCEL', 'blue');

  // Black warning triangle dialog
  drawWindow(ctx, 6, 84, 54, 30, 'WARN', 'dark');
  drawWarningTriangle(ctx, 20, 94);
  drawButton(ctx, 36, 101, 'OK', 'dark');

  // Hourglass
  drawHourglass(ctx, 6, 68);

  // Bottom-left Auth Login Bar
  drawWindow(ctx, 10, 117, 146, 21, 'AUTH', 'dark');
  drawText(ctx, 'USER', 16, 126, WHITE, 1);
  drawRectOutline(ctx, 36, 125, 38, 6, BLACK, WHITE, 1);
  drawText(ctx, 'PASS', 78, 126, WHITE, 1);
  drawRectOutline(ctx, 98, 125, 28, 6, BLACK, WHITE, 1);
  drawButton(ctx, 130, 125, 'OK', 'dark');

  // 3. ZONE 2 (Center: x 110..260, visible below y ~ 31)
  // Blue LOADING... window
  drawWindow(ctx, 102, 54, 78, 34, 'SCAN', 'blue');
  drawText(ctx, 'LOADING...', 110, 65, WHITE, 1);
  drawRectOutline(ctx, 110, 73, 62, 7, BLACK, WHITE, 1);
  for (let b = 0; b < 9; b++) {
    px(ctx, 112 + b * 4, 75, 2, 3, WHITE);
  }

  // Cascading ERROR stack (4 layers)
  for (let i = 3; i >= 1; i--) {
    drawWindow(ctx, 174 + i * 3, 35 + i * 3, 74, 34, 'ERROR', 'dark');
  }
  drawWindow(ctx, 174, 35, 74, 34, 'ERROR', 'dark');
  drawText(ctx, 'PHISH ALERT!', 182, 48, WHITE, 1);
  drawButton(ctx, 202, 56, 'OK', 'dark');

  // "STAY SAFE" bold badge + smiley transform box
  drawWindow(ctx, 88, 90, 48, 22, 'SHIELD', 'dark');
  drawText(ctx, 'BLOCKED', 95, 101, WHITE, 1);
  drawSmileyBox(ctx, 62, 92);

  // Blue PAYLOAD.EXE progress window
  drawWindow(ctx, 152, 84, 122, 40, 'SCANNING...', 'blue');
  drawText(ctx, 'PAYLOAD.EXE', 160, 94, WHITE, 1);
  drawText(ctx, 'TO SANDBOX', 160, 102, WHITE, 1);
  drawRectOutline(ctx, 160, 110, 76, 7, BLUE, WHITE, 1);
  for (let b = 0; b < 10; b++) {
    px(ctx, 162 + b * 4, 112, 2, 3, WHITE);
  }
  drawButton(ctx, 240, 109, 'ABORT', 'blue');

  // White high-contrast FIX popup overlapping
  drawWindow(ctx, 114, 103, 76, 34, 'ERROR', 'light');
  drawCircleX(ctx, 124, 118, 4, BLACK, WHITE);
  drawText(ctx, 'CLICK FIX', 132, 114, BLACK, 1);
  drawButton(ctx, 140, 123, 'FIX', 'light');

  // 4. ZONE 3 (Tall Right-Center: x 256..376, visible below y ~ 9)
  drawWindow(ctx, 260, 11, 104, 88, 'VIRUS DETECTED', 'blue');
  drawDitheredSkull(ctx, 294, 21);
  drawText(ctx, 'ACCESS TO HOST', 268, 62, WHITE, 1);
  drawText(ctx, 'WAS DENIED', 274, 70, WHITE, 1);
  drawButton(ctx, 286, 82, 'RETRY', 'blue');

  // Vertical Paint / Forensics Toolbar Palette on the right
  drawToolbarPalette(ctx, 346, 48);

  // Small extra pixel error badge on far right
  drawWindow(ctx, 376, 22, 22, 24, 'X', 'dark');
  drawCircleX(ctx, 387, 36, 4, BLUE, WHITE);

  // Bottom right status mini-box
  drawWindow(ctx, 278, 106, 62, 28, 'LOG', 'dark');
  drawText(ctx, 'EDL: 0.99', 284, 118, WHITE, 1);
  drawText(ctx, 'QUARANTINE', 284, 125, BLUE, 1);

  return ctx.getImageData(0, 0, W, H);
}
