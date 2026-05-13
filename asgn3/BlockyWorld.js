// ── Shaders ──────────────────────────────────────────────────────────────────
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  attribute vec2 a_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectMatrix;
  varying vec4 v_Color;
  varying vec2 v_UV;
  void main() {
    gl_Position = u_ProjectMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_Color = a_Color;
    v_UV = a_UV;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;
  varying vec2 v_UV;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform int u_whichTexture;
  void main() {
    if (u_whichTexture == -2) {
      gl_FragColor = v_Color;
    } else if (u_whichTexture == -1) {
      gl_FragColor = vec4(v_UV, 1.0, 1.0);
    } else if (u_whichTexture == 0) {
      gl_FragColor = texture2D(u_Sampler0, v_UV) * vec4(v_Color.rgb, 1.0);
    } else if (u_whichTexture == 1) {
      gl_FragColor = texture2D(u_Sampler1, v_UV) * vec4(v_Color.rgb, 1.0);
    } else {
      gl_FragColor = v_Color;
    }
  }
`;

// ── Globals ───────────────────────────────────────────────────────────────────
let canvas;
let gl;
let a_Position;
let a_Color;
let a_UV;
let u_ModelMatrix;
let u_ViewMatrix;
let u_ProjectMatrix;
let u_Sampler0;
let u_Sampler1;
let u_whichTexture;

let g_camera;
let g_keysPressed  = {};
let g_isDragging   = false;
let g_lastMouseX   = 0;
let g_lastMouseY   = 0;
let g_mouseX       = -1;   // current cursor position on canvas (client coords)
let g_mouseY       = -1;   // -1 = not yet tracked / off-canvas
let g_yVelocity    = 0;
let g_isGrounded   = false;

const GRAVITY        = 0.008;
const JUMP_SPEED     = 0.18;
const PLAYER_HEIGHT  = 1.5;   // eye height above feet
const PLAYER_RADIUS  = 0.5;  // horizontal collision radius (bigger = more gap from block faces)
let g_lastFrameTime = performance.now();
let g_startTime     = performance.now() / 1000;
let g_seconds       = 0;

// ── Peacock world state ───────────────────────────────────────────────────────
let g_pockX       = 14;      // world X
let g_pockZ       = 14;      // world Z
let g_pockFeetY   = 1;       // Y of feet (physics-driven)
let g_pockVY      = 0;       // vertical velocity
let g_pockFacing  = 0;       // degrees – rotation around Y (0 = faces +X)
let g_pockTarget  = 0;       // target facing angle (smooth turn)
let g_pockTimer   = 60;      // frames until next direction pick
let g_pockStuckCt = 0;       // frames blocked in a row

const POCK_SPEED  = 0.03;
const POCK_RADIUS = 0.2;

// ── World map ─────────────────────────────────────────────────────────────────
// g_map[x][z] = Uint8Array(MAX_HEIGHT): g_map[x][z][y] = 1 if block exists, 0 if empty.
// Sparse — individual blocks can be added or removed at any layer.
const WORLD_SIZE = 32;
const MAX_HEIGHT  = 16;
let g_map = [];

// Returns y+1 of the highest filled block in column (mx,mz), or 0 if empty.
// Used for collision / physics (same semantics as the old integer height).
function colHeight(mx, mz) {
  if (mx < 0 || mx >= WORLD_SIZE || mz < 0 || mz >= WORLD_SIZE) return 0;
  for (let y = MAX_HEIGHT - 1; y >= 0; y--) {
    if (g_map[mx][mz][y]) return y + 1;
  }
  return 0;
}

function initMap() {
  for (let x = 0; x < WORLD_SIZE; x++) {
    g_map[x] = [];
    for (let z = 0; z < WORLD_SIZE; z++) {
      g_map[x][z] = new Uint8Array(MAX_HEIGHT);
    }
  }

  // Fill a column from y=0 up to height h
  const fill = (x, z, h) => {
    for (let y = 0; y < Math.min(h, MAX_HEIGHT); y++) g_map[x][z][y] = 1;
  };

  // ── Ground platform (20×20 in the center) ──
  for (let x = 6; x < 26; x++)
    for (let z = 6; z < 26; z++)
      fill(x, z, 1);

  // ── Hill in the southwest corner of the platform ──
  for (const [x,z,h] of [
    [8,8,2],[9,8,2],[8,9,2],[9,9,3],
    [10,9,2],[9,10,2],[10,10,4],[11,10,3],[10,11,2]
  ]) fill(x, z, h);

  // ── Tower in the northeast ──
  fill(21, 21, 7);
  for (const [ox,oz] of [[-1,0],[1,0],[0,-1],[0,1]]) fill(21+ox, 21+oz, 2);

  // ── Wall running east–west ──
  for (let z = 13; z < 22; z++) fill(15, z, 3);

  // ── Staircase along the south edge ──
  for (let i = 0; i < 6; i++) fill(7+i, 8+i, i+1);

  // ── Decorative pillars ──
  for (const [x,z,h] of [[18,8,3],[22,8,2],[18,23,3],[22,23,4]]) fill(x, z, h);

  // ── Scattered low blocks ──
  for (let x = 8; x < 25; x += 3) fill(x, 24, 2);
  for (let x = 8; x < 25; x += 4) fill(x, 6,  2);
}

// ── WebGL setup ───────────────────────────────────────────────────────────────
function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) { console.log('Failed to get WebGL context'); return false; }
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.53, 0.81, 0.98, 1.0);  // sky blue
  return true;
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.'); return false;
  }
  a_Position      = gl.getAttribLocation(gl.program,  'a_Position');
  a_Color         = gl.getAttribLocation(gl.program,  'a_Color');
  a_UV            = gl.getAttribLocation(gl.program,  'a_UV');
  u_ModelMatrix   = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix    = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectMatrix = gl.getUniformLocation(gl.program, 'u_ProjectMatrix');
  u_Sampler0      = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1      = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_whichTexture  = gl.getUniformLocation(gl.program, 'u_whichTexture');
  if (a_Position < 0 || a_Color < 0 || a_UV < 0 ||
      !u_ModelMatrix || !u_ViewMatrix || !u_ProjectMatrix ||
      !u_Sampler0 || !u_whichTexture) {
    console.log('Failed to get shader variable locations'); return false;
  }
  return true;
}

// ── Textures ──────────────────────────────────────────────────────────────────
function _uploadTex(data, w, h, unit) {
  const tex = gl.createTexture();
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
}

// TEXTURE0 is a 16×32 grass atlas packed vertically (UNPACK_FLIP_Y=1 so:
//   data row 0   → v≈1.00  (top of UV)
//   data row 7   → v≈0.75  ─┐ grass-top region   v=[0.75, 1.00]
//   data row 8   → v≈0.75  ─┘
//   data row 11  → v≈0.625  ─┐ green strip on side
//   data row 23  → v≈0.25   ─┘ grass-side region  v=[0.25, 0.75]
//   data row 24  → v≈0.25  ─┐ dirt region         v=[0.00, 0.25]
//   data row 31  → v≈0.00   ─┘
function initTextures() {
  const C = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // Deterministic pixel-art noise — keeps variation small for low-res look
  const px = (x, y, seed) => ((x * 1361 + y * 1619 + seed) ^ (x * 13)) % 16 - 8;

  // ── TEXTURE0: 16×32 grass atlas ──────────────────────────────────────────
  const W = 16, H = 32;
  const atlas = new Uint8Array(W * H * 4);
  for (let row = 0; row < H; row++) {
    for (let x = 0; x < W; x++) {
      const i = (row * W + x) * 4;
      const n = px(x, row, 0);
      if (row < 8) {
        // Grass top — bright Minecraft green
        atlas[i]   = C(94  + n / 2, 0, 255);
        atlas[i+1] = C(157 + n,     0, 255);
        atlas[i+2] = C(52  + n / 2, 0, 255);
      } else if (row < 12) {
        // Grass side — green strip (top ~4px of the side face after flip)
        atlas[i]   = C(88  + n / 2, 0, 255);
        atlas[i+1] = C(148 + n,     0, 255);
        atlas[i+2] = C(46  + n / 2, 0, 255);
      } else if (row < 24) {
        // Grass side — dirt/brown lower portion
        atlas[i]   = C(134 + n, 0, 255);
        atlas[i+1] = C(96  + n, 0, 255);
        atlas[i+2] = C(67  + n, 0, 255);
      } else {
        // Pure dirt (bottom face)
        atlas[i]   = C(131 + n, 0, 255);
        atlas[i+1] = C(93  + n, 0, 255);
        atlas[i+2] = C(64  + n, 0, 255);
      }
      atlas[i+3] = 255;
    }
  }
  _uploadTex(atlas, W, H, 0);
  gl.uniform1i(u_Sampler0, 0);

  // ── TEXTURE1: 16×16 stone ────────────────────────────────────────────────
  const stone = new Uint8Array(16 * 16 * 4);
  for (let row = 0; row < 16; row++) {
    for (let x = 0; x < 16; x++) {
      const i = (row * 16 + x) * 4;
      const n = px(x, row, 99);
      // Occasional dark crack pixels for Minecraft stone look
      const crack = (((x * 7 + row * 13) ^ (x * 3 + row)) % 19 === 0) ? -40 : 0;
      const v = C(128 + n + crack, 0, 255);
      stone[i] = stone[i+1] = stone[i+2] = v;
      stone[i+3] = 255;
    }
  }
  _uploadTex(stone, 16, 16, 1);
  if (u_Sampler1) gl.uniform1i(u_Sampler1, 1);
}

// Load an external image into texture unit `texUnit` (0 or 1).
// Usage: sendImageToTexture('dirt.jpg', 0)
function sendImageToTexture(src, texUnit) {
  const img = new Image();
  img.onload = () => {
    const tex = gl.createTexture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0 + texUnit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.uniform1i(u_Sampler0, texUnit);
  };
  img.src = src;
}

let g_texMode = -2;  // -2=color  -1=UV debug  0=texture

// ── Input / UI ────────────────────────────────────────────────────────────────
function addActionsForHtmlUI() {
  document.addEventListener('keydown', ev => { g_keysPressed[ev.key.toLowerCase()] = true;  });
  document.addEventListener('keyup',   ev => { g_keysPressed[ev.key.toLowerCase()] = false; });

  canvas.onmousedown = ev => {
    g_isDragging = true;
    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;
    if (ev.button === 0) placeBlock(ev.clientX, ev.clientY);
    if (ev.button === 2) deleteBlock(ev.clientX, ev.clientY);
  };
  canvas.onmouseup    = () => { g_isDragging = false; };
  canvas.onmouseleave = () => { g_isDragging = false; g_mouseX = -1; };
  canvas.onmousemove  = ev => {
    g_mouseX = ev.clientX;   // always track — used for hover highlight
    g_mouseY = ev.clientY;
    if (!g_isDragging) return;
    const dx = ev.clientX - g_lastMouseX;
    const dy = ev.clientY - g_lastMouseY;
    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;
    g_camera.panLeft(dx * 0.4);
    g_camera.panUp(-dy * 0.4);
  };
  canvas.oncontextmenu = ev => ev.preventDefault();

  document.getElementById('texColor').onclick  = () => { g_texMode = -2; };
  document.getElementById('texUVdbg').onclick  = () => { g_texMode = -1; };
  document.getElementById('texTex').onclick    = () => { g_texMode =  0; };

  document.getElementById('fovSlide').addEventListener('input', function() {
    g_camera.fov = Number(this.value);
    g_camera.updateProjectionMatrix();
    document.getElementById('fovValue').textContent = this.value;
  });
}

// ── Block picking ─────────────────────────────────────────────────────────────
// Unprojects a canvas pixel (clientX, clientY) into a world-space ray.
// Returns { ox, oy, oz, dx, dy, dz } with a normalised direction vector.
function screenToWorldRay(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const cx   = clientX - rect.left;
  const cy   = clientY - rect.top;

  // Normalised device coordinates: X right, Y up, both in [-1, 1]
  const ndcX =  (cx / canvas.width)  * 2 - 1;
  const ndcY = -(cy / canvas.height) * 2 + 1;

  // Inverse of (projection × view) transforms NDC → world space
  const vpInv = new Matrix4();
  vpInv.set(g_camera.projectionMatrix);
  vpInv.multiply(g_camera.viewMatrix);
  vpInv.invert();

  // Unproject near (z=-1) and far (z=1) clip-space points
  const near = vpInv.multiplyVector4(new Vector4([ndcX, ndcY, -1, 1]));
  const far  = vpInv.multiplyVector4(new Vector4([ndcX, ndcY,  1, 1]));

  // Perspective divide
  const nw = near.elements[3], fw = far.elements[3];
  const nx = near.elements[0]/nw, ny = near.elements[1]/nw, nz = near.elements[2]/nw;
  const fx = far.elements[0]/fw,  fy = far.elements[1]/fw,  fz = far.elements[2]/fw;

  const rdx = fx-nx, rdy = fy-ny, rdz = fz-nz;
  const rlen = Math.sqrt(rdx*rdx + rdy*rdy + rdz*rdz);
  return { ox: nx, oy: ny, oz: nz, dx: rdx/rlen, dy: rdy/rlen, dz: rdz/rlen };
}

// Marches the ray until it enters an occupied voxel.
// Uses Math.round (not Math.floor) because blocks are centered at integer world
// coords: block n occupies [n-0.5, n+0.5], so the correct cell for position p
// is Math.round(p), not Math.floor(p).
// Y range uses the actual block extents: column of height h spans y ∈ (-0.5, h-0.5).
function castRay(clientX, clientY) {
  const { ox, oy, oz, dx, dy, dz } = screenToWorldRay(clientX, clientY);

  let prevX = -1, prevZ = -1, prevY = -1;
  for (let t = 0.1; t <= 4; t += 0.01) {
    const wx   = Math.round(ox + dx * t);
    const wz   = Math.round(oz + dz * t);
    const wy_r = Math.round(oy + dy * t);
    if (wx < 0 || wx >= WORLD_SIZE || wz < 0 || wz >= WORLD_SIZE) break;
    if (wy_r >= 0 && wy_r < MAX_HEIGHT && g_map[wx][wz][wy_r]) {
      return { hitX: wx, hitZ: wz, hitY: wy_r, prevX, prevZ, prevY };
    }
    prevX = wx; prevZ = wz; prevY = wy_r;
  }
  return null;
}

function placeBlock(clientX, clientY) {
  const hit = castRay(clientX, clientY);
  if (!hit) return;

  // Determine placement position from which face the ray entered:
  //   XZ changed  → side face   → place at hitY in the prev cell (same height as hit block)
  //   prevY > hitY → top face    → place one above the hit block
  //   prevY < hitY → bottom face → place one below the hit block
  let px, py, pz;
  const sideHit = (hit.prevX !== hit.hitX || hit.prevZ !== hit.hitZ);
  if (sideHit) {
    px = hit.prevX; py = hit.hitY;     pz = hit.prevZ;
  } else if (hit.prevY > hit.hitY) {
    px = hit.hitX;  py = hit.hitY + 1; pz = hit.hitZ;   // top face
  } else {
    px = hit.hitX;  py = hit.hitY - 1; pz = hit.hitZ;   // bottom face
  }

  if (px >= 0 && px < WORLD_SIZE && pz >= 0 && pz < WORLD_SIZE &&
      py >= 0 && py < MAX_HEIGHT && !g_map[px][pz][py]) {
    g_map[px][pz][py] = 1;
    resolveStuck();
  }
}

function deleteBlock(clientX, clientY) {
  const hit = castRay(clientX, clientY);
  if (!hit) return;
  if (hit.hitY === 0) return;   // floor (y=0) is indestructible
  g_map[hit.hitX][hit.hitZ][hit.hitY] = 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  if (!setupWebGL())             return;
  if (!connectVariablesToGLSL()) return;

  initTextures();
  initMap();

  g_camera = new Camera();
  // eye.y = ground height (1) + PLAYER_HEIGHT so feet land exactly on the platform
  g_camera.eye = new Vector3([16, 2.5, 21]);
  g_camera.at  = new Vector3([16, 2.5, 20]);
  g_camera.updateProjectionMatrix();

  addActionsForHtmlUI();

  requestAnimationFrame(tick);
}

// ── Animation loop ────────────────────────────────────────────────────────────
function tick() {
  const now = performance.now();
  const fps = Math.round(1000 / (now - g_lastFrameTime));
  g_lastFrameTime = now;

  g_seconds = performance.now() / 1000 - g_startTime;
  handleKeys();
  applyPhysics();
  resolveStuck();
  updatePeacock();

  const t0 = performance.now();
  renderAllShapes();
  const renderMs = (performance.now() - t0).toFixed(1);

  document.getElementById('fps').innerHTML =
    'FPS: ' + fps + ' &nbsp;|&nbsp; render: ' + renderMs + ' ms';

  requestAnimationFrame(tick);
}

// ── Physics helpers ───────────────────────────────────────────────────────────
// Math.round matches castRay: block n is centered at n and covers [n-0.5, n+0.5].
// Math.floor would map position 15.6 → column 15, missing the block at column 16
// whose face starts at 15.5 — allowing the camera to clip 0.5 units in.
function getColumnHeight(x, z) {
  return colHeight(Math.round(x), Math.round(z));
}

// Highest block under any corner of the player footprint
function floorUnderPlayer(x, z) {
  const r = PLAYER_RADIUS;
  return Math.max(
    getColumnHeight(x - r, z),
    getColumnHeight(x + r, z),
    getColumnHeight(x, z - r),
    getColumnHeight(x, z + r)
  );
}

// Returns true if moving to (nx, nz) would put the player inside a block.
// Checks all 4 corners of the square footprint to catch diagonal/corner clips.
// No auto-step: the player must jump to climb any block.
function horizontallyBlocked(nx, nz) {
  const feetY = g_camera.eye.elements[1] - PLAYER_HEIGHT;
  const r = PLAYER_RADIUS;
  for (const [cx, cz] of [
    [nx - r, nz - r], [nx + r, nz - r],
    [nx - r, nz + r], [nx + r, nz + r],
  ]) {
    // 0.05 epsilon for float drift — not enough to auto-climb any block (1 unit tall)
    if (getColumnHeight(cx, cz) > feetY + 0.05) return true;
  }
  return false;
}

// Apply gravity, landing, and ceiling each tick.
function applyPhysics() {
  const e = g_camera.eye.elements;
  const a = g_camera.at.elements;

  g_yVelocity -= GRAVITY;

  const floorH    = floorUnderPlayer(e[0], e[2]);
  const newEyeY   = e[1] + g_yVelocity;
  const newFeetY  = newEyeY - PLAYER_HEIGHT;

  if (newFeetY <= floorH) {
    // Land: snap feet to floor surface
    const snapEyeY = floorH + PLAYER_HEIGHT;
    a[1]  += snapEyeY - e[1];
    e[1]   = snapEyeY;
    if (g_yVelocity < 0) { g_yVelocity = 0; g_isGrounded = true; }
  } else {
    a[1] += g_yVelocity;
    e[1]  = newEyeY;
    g_isGrounded = false;
  }
}

// If any corner of the player footprint is currently inside a block, push the
// player upward until they stand on top of the tallest overlapping block.
// Runs every frame so the player can always escape — covers falling into gaps,
// placing a block on themselves, or any other way they ended up embedded.
function resolveStuck() {
  const e = g_camera.eye.elements;
  const a = g_camera.at.elements;
  const r = PLAYER_RADIUS;
  const feetY = e[1] - PLAYER_HEIGHT;

  let maxH = 0;
  let stuck = false;
  for (const [cx, cz] of [
    [e[0] - r, e[2] - r], [e[0] + r, e[2] - r],
    [e[0] - r, e[2] + r], [e[0] + r, e[2] + r],
  ]) {
    const h = getColumnHeight(cx, cz);
    if (h > feetY + 0.05) { stuck = true; maxH = Math.max(maxH, h); }
  }

  if (stuck) {
    const newEyeY = maxH + PLAYER_HEIGHT;
    if (newEyeY > e[1]) {          // only push UP — never sink through floors
      a[1] += newEyeY - e[1];
      e[1]  = newEyeY;
      g_yVelocity  = 0;
      g_isGrounded = true;
    }
  }
}

// Move camera by (dx, dz) in world space, with per-axis collision so you
// slide along walls instead of stopping dead.
function tryMoveXZ(dx, dz) {
  const e = g_camera.eye.elements;
  const a = g_camera.at.elements;
  if (!horizontallyBlocked(e[0] + dx, e[2]))       { e[0] += dx; a[0] += dx; }
  if (!horizontallyBlocked(e[0],      e[2] + dz))  { e[2] += dz; a[2] += dz; }
}

function handleKeys() {
  const spd = 0.1;
  if (g_keysPressed['w'] || g_keysPressed['arrowup']) {
    const f = g_camera._fwdXZ();
    tryMoveXZ(f.elements[0] * spd, f.elements[2] * spd);
  }
  if (g_keysPressed['s'] || g_keysPressed['arrowdown']) {
    const f = g_camera._fwdXZ();
    tryMoveXZ(-f.elements[0] * spd, -f.elements[2] * spd);
  }
  if (g_keysPressed['a'] || g_keysPressed['arrowleft']) {
    const r = g_camera._right();
    tryMoveXZ(-r.elements[0] * spd, -r.elements[2] * spd);
  }
  if (g_keysPressed['d'] || g_keysPressed['arrowright']) {
    const r = g_camera._right();
    tryMoveXZ(r.elements[0] * spd, r.elements[2] * spd);
  }
  if (g_keysPressed[' '] && g_isGrounded) {
    g_yVelocity  = JUMP_SPEED;
    g_isGrounded = false;
  }
  if (g_keysPressed['q']) g_camera.panLeft(2);
  if (g_keysPressed['e']) g_camera.panRight(2);
}

// ── Rendering ─────────────────────────────────────────────────────────────────
// Block color table by stack layer
function blockColor(x, z, y, maxH) {
  if (y === 0) {
    // Checkerboard dirt/stone for the ground layer
    return (x + z) % 2 === 0
      ? [0.36, 0.25, 0.15, 1.0]   // dark dirt
      : [0.42, 0.30, 0.18, 1.0];  // light dirt
  }
  if (y === maxH - 1) {
    // Top layer: grass or stone depending on height
    if (maxH <= 2) return [0.30, 0.60, 0.18, 1.0];  // grass green
    if (maxH <= 4) return [0.50, 0.52, 0.50, 1.0];  // mossy stone
    return [0.62, 0.62, 0.65, 1.0];                  // grey stone top
  }
  // Middle layers
  if (maxH <= 3) return [0.28, 0.20, 0.12, 1.0];    // deeper dirt
  return [0.55, 0.55, 0.57, 1.0];                    // stone
}

// ── Peacock animal (ported from asgn2) ───────────────────────────────────────
// wx/wy/wz = world position of the animal's base (feet level).
// Scaled 2× relative to asgn2 so it reads clearly at block scale.
// ── Peacock physics & AI ─────────────────────────────────────────────────────
function pockFloor(x, z) {
  const r = POCK_RADIUS;
  return Math.max(
    getColumnHeight(x - r, z - r), getColumnHeight(x + r, z - r),
    getColumnHeight(x - r, z + r), getColumnHeight(x + r, z + r)
  );
}

// True if the peacock cannot move to (nx, nz).
// Blocks on: walls taller than current feet, or cells with no ground at all
// (prevents walking off the platform edge).
function pockBlocked(nx, nz) {
  const r = POCK_RADIUS;
  let hasGround = false;
  for (const [cx, cz] of [
    [nx - r, nz - r], [nx + r, nz - r],
    [nx - r, nz + r], [nx + r, nz + r],
  ]) {
    const h = getColumnHeight(cx, cz);
    if (h > g_pockFeetY + 0.05) return true;  // wall
    if (h > 0) hasGround = true;
  }
  return !hasGround;  // no ground = edge of platform, treat as blocked
}

function updatePeacock() {
  // ── Gravity ──────────────────────────────────────────────────────────────
  g_pockVY -= GRAVITY;
  const floorH = pockFloor(g_pockX, g_pockZ);
  const newFY  = g_pockFeetY + g_pockVY;
  if (newFY <= floorH) {
    g_pockFeetY = floorH;
    g_pockVY    = 0;
  } else {
    g_pockFeetY = newFY;
  }

  // ── Direction AI ─────────────────────────────────────────────────────────
  g_pockTimer--;
  if (g_pockTimer <= 0 || g_pockStuckCt > 20) {
    g_pockTarget  = Math.random() * 360;
    g_pockTimer   = 80 + Math.floor(Math.random() * 120);
    g_pockStuckCt = 0;
  }

  // Smooth turn toward target (3 deg/frame) so the body visibly pivots
  let diff = ((g_pockTarget - g_pockFacing) % 360 + 540) % 360 - 180;
  g_pockFacing = (g_pockFacing + Math.sign(diff) * Math.min(Math.abs(diff), 3) + 360) % 360;

  // ── Walk forward ─────────────────────────────────────────────────────────
  const rad = g_pockFacing * Math.PI / 180;
  const dx  =  Math.cos(rad) * POCK_SPEED;
  const dz  = -Math.sin(rad) * POCK_SPEED;
  let moved = false;
  if (!pockBlocked(g_pockX + dx, g_pockZ)) { g_pockX += dx; moved = true; }
  if (!pockBlocked(g_pockX, g_pockZ + dz)) { g_pockZ += dz; moved = true; }
  if (!moved) g_pockStuckCt++;

  // ── Safety reset if it falls into the void ───────────────────────────────
  if (g_pockFeetY < -2) {
    g_pockX = 16; g_pockZ = 14; g_pockFeetY = 1; g_pockVY = 0;
  }
}

function drawAnimal(wx, wy, wz, facing = 0) {
  const t           = g_seconds;
  const wingFlap    = 10  * Math.sin(t * 2.0);
  const legSwing    = 30  * Math.sin(t * 1.5);
  const featherSprd = 12  + 13 * Math.abs(Math.sin(t * 0.3));
  const bodyBob     = 0.04 * Math.sin(t * 1.2);
  const headBob     = 18  * Math.sin(t * 0.9);

  // World base: translate → face walk direction → scale 2×, with body bob
  const base = new Matrix4();
  base.setTranslate(wx, wy + bodyBob, wz);
  base.rotate(facing, 0, 1, 0);
  base.scale(2, 2, 2);

  function cube(color, buildFn) {
    const c = new Cube();
    c.textureNum = -2;
    c.color = color;
    buildFn(c);
    c.render();
    return c;
  }
  function cyl(color, buildFn) {
    const c = new Cylinder();
    c.textureNum = -2;
    c.color = color;
    buildFn(c);
    c.render();
    return c;
  }

  // ── BODY ──────────────────────────────────────────────────────────────────
  let bodyCoord;
  cube([0.05, 0.35, 0.60, 1.0], c => {
    c.matrix = new Matrix4(base);
    c.matrix.translate(0.0, 0.15, 0.0);
    bodyCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.55, 0.22, 0.28);
  });

  // ── NECK ──────────────────────────────────────────────────────────────────
  let neckCoord;
  cube([0.0, 0.55, 0.48, 1.0], c => {
    c.matrix = new Matrix4(bodyCoord);
    c.matrix.translate(0.22, 0.14, 0.0);
    c.matrix.rotate(-15, 0, 0, 1);
    c.matrix.rotate(headBob, 0, 1, 0);
    neckCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.1, 0.3, 0.1);
  });

  // ── HEAD ──────────────────────────────────────────────────────────────────
  let headCoord;
  cube([0.1, 0.45, 0.78, 1.0], c => {
    c.matrix = new Matrix4(neckCoord);
    c.matrix.translate(0.04, 0.28, 0.0);
    headCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.2, 0.16, 0.18);
  });

  // ── BEAK ──────────────────────────────────────────────────────────────────
  let beakCoord;
  cube([0.9, 0.78, 0.15, 1.0], c => {
    c.matrix = new Matrix4(headCoord);
    c.matrix.translate(0.13, -0.02, 0.0);
    beakCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.1, 0.05, 0.07);
  });
  cube([0.85, 0.70, 0.1, 1.0], c => {
    c.matrix = new Matrix4(beakCoord);
    c.matrix.translate(0, -0.04, 0.0);
    c.matrix.scale(0.08, 0.03, 0.05);
  });

  // ── EYES ──────────────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    cyl([0.05, 0.05, 0.08, 1.0], c => {
      c.matrix = new Matrix4(headCoord);
      c.matrix.translate(0.03, 0.02, side * 0.09);
      c.matrix.rotate(90, 1, 0, 0);
      c.matrix.scale(0.04, 0.015, 0.04);
    });
  }

  // ── TAIL BASE ─────────────────────────────────────────────────────────────
  let tailCoord;
  cube([0.0, 0.48, 0.28, 1.0], c => {
    c.matrix = new Matrix4(bodyCoord);
    c.matrix.translate(-0.2, 0.06, 0.0);
    tailCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.22, 0.12, 0.2);
  });

  // ── TAIL FEATHERS ─────────────────────────────────────────────────────────
  const featherColors = [
    [0.0,  0.55, 0.9,  1.0], [0.85, 0.75, 0.0, 1.0], [0.15, 0.75, 0.2, 1.0],
    [0.0,  0.55, 0.9,  1.0], [0.15, 0.75, 0.2, 1.0], [0.0,  0.55, 0.9, 1.0],
    [0.15, 0.75, 0.2,  1.0], [0.85, 0.75, 0.0, 1.0], [0.0,  0.55, 0.9, 1.0],
  ];
  for (let i = 0; i < 9; i++) {
    cube(featherColors[i], c => {
      c.matrix = new Matrix4(tailCoord);
      c.matrix.rotate((i - 4) * featherSprd, 1, 0, 0);
      c.matrix.translate(0.0, 0.52, 0.0);
      c.matrix.scale(0.05, 0.62, 0.05);
    });
  }

  // ── WINGS ─────────────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    cube([0.02, 0.30, 0.55, 1.0], c => {
      c.matrix = new Matrix4(bodyCoord);
      c.matrix.translate(0.0, 0.0, side * 0.17);
      c.matrix.rotate(side * (20 - wingFlap), 1, 0, 0);
      c.matrix.scale(0.45, 0.07, 0.12);
    });
  }

  // ── LEFT LEG ──────────────────────────────────────────────────────────────
  let leftUpperCoord, leftLowerCoord;
  cube([0.58, 0.50, 0.38, 1.0], c => {
    c.matrix = new Matrix4(bodyCoord);
    c.matrix.translate(-0.1, -0.2, -0.08);
    c.matrix.rotate(legSwing, 0, 0, 1);
    leftUpperCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.08, 0.24, 0.08);
  });
  cube([0.50, 0.43, 0.32, 1.0], c => {
    c.matrix = new Matrix4(leftUpperCoord);
    c.matrix.translate(0.0, -0.12, 0.0);
    c.matrix.rotate(30, 0, 0, 1);
    leftLowerCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.07, 0.20, 0.07);
  });
  cube([0.42, 0.36, 0.26, 1.0], c => {
    c.matrix = new Matrix4(leftLowerCoord);
    c.matrix.translate(0.06, -0.10, 0.0);
    c.matrix.rotate(-20, 0, 0, 1);
    c.matrix.scale(0.15, 0.03, 0.08);
  });

  // ── RIGHT LEG ─────────────────────────────────────────────────────────────
  let rightUpperCoord, rightLowerCoord;
  cube([0.58, 0.50, 0.38, 1.0], c => {
    c.matrix = new Matrix4(bodyCoord);
    c.matrix.translate(-0.1, -0.2, 0.08);
    c.matrix.rotate(-legSwing * 0.8, 0, 0, 1);
    rightUpperCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.08, 0.24, 0.08);
  });
  cube([0.50, 0.43, 0.32, 1.0], c => {
    c.matrix = new Matrix4(rightUpperCoord);
    c.matrix.translate(0.0, -0.12, 0.0);
    c.matrix.rotate(30, 0, 0, 1);
    rightLowerCoord = new Matrix4(c.matrix);
    c.matrix.scale(0.07, 0.20, 0.07);
  });
  cube([0.42, 0.36, 0.26, 1.0], c => {
    c.matrix = new Matrix4(rightLowerCoord);
    c.matrix.translate(0.06, -0.10, 0.0);
    c.matrix.rotate(-20, 0, 0, 1);
    c.matrix.scale(0.15, 0.03, 0.08);
  });
}

// Single Cube instance reused every frame — avoids per-block allocation
const g_cube = new Cube();

// ── Block highlight wireframe ─────────────────────────────────────────────────
// Pre-built once: 12 edges × 2 vertices, each [xyz rgba uv], inflated 1% to
// sit just outside the block face so there is no z-fighting.
const _WIRE_VERTS = (() => {
  const s = 0.507;
  const c = [
    [-s,-s,-s],[+s,-s,-s],[+s,-s,+s],[-s,-s,+s],  // bottom ring
    [-s,+s,-s],[+s,+s,-s],[+s,+s,+s],[-s,+s,+s],  // top ring
  ];
  const edges = [
    [0,1],[1,2],[2,3],[3,0],  // bottom face
    [4,5],[5,6],[6,7],[7,4],  // top face
    [0,4],[1,5],[2,6],[3,7],  // verticals
  ];
  const d = [];
  for (const [a, b] of edges) {
    for (const v of [c[a], c[b]]) {
      d.push(v[0],v[1],v[2], 0,0,0,1, 0,0);  // black, UV unused
    }
  }
  return new Float32Array(d);
})();
let g_wireBuf = null;

function drawWireframe(x, y, z) {
  const mat = new Matrix4();
  mat.setTranslate(x, y, z);
  gl.uniformMatrix4fv(u_ModelMatrix, false, mat.elements);
  gl.uniform1i(u_whichTexture, -2);

  if (!g_wireBuf) g_wireBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_wireBuf);
  gl.bufferData(gl.ARRAY_BUFFER, _WIRE_VERTS, gl.STATIC_DRAW);

  const F = _WIRE_VERTS.BYTES_PER_ELEMENT, S = 9 * F;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, S, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_Color,    4, gl.FLOAT, false, S, 3 * F);
  gl.enableVertexAttribArray(a_Color);
  gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, S, 7 * F);
  gl.enableVertexAttribArray(a_UV);

  gl.lineWidth(2);
  gl.drawArrays(gl.LINES, 0, 24);
}

// ── Stars ─────────────────────────────────────────────────────────────────────
// Pre-built at load time — Fibonacci sphere sampling on the upper hemisphere
const _STARS = (() => {
  const out = [], R = 45, cx = 16, cz = 16, N = 160;
  for (let i = 0; i < N; i++) {
    const phi   = Math.acos(1 - (i + 0.5) / N);   // 0 = top, π/2 = equator
    const theta = i * 2.39996323;                  // golden angle
    const y     = R * Math.cos(phi);
    if (y < 3) continue;                           // skip below skyline
    out.push([cx + R * Math.sin(phi) * Math.cos(theta), y,
              cz + R * Math.sin(phi) * Math.sin(theta)]);
  }
  return out;
})();

const g_starCube = new Cube();  // single instance reused for all stars

// ── Grass sprites ─────────────────────────────────────────────────────────────
// Each sprite = 2 crossed quads = 12 vertices × 9 floats.
// ── Water ─────────────────────────────────────────────────────────────────────
// 36×36 tile mesh that extends 2 units beyond the world border on every side.
// Each tile corner gets an animated wave height; colour fades from shallow
// turquoise near the island to deep blue further out.
const _WATER_DIM  = 36;
const g_waterData = new Float32Array(_WATER_DIM * _WATER_DIM * 6 * 9);
let   g_waterBuf  = null;

function drawWater() {
  const d = g_waterData, t = g_seconds;
  let vi = 0;

  for (let tx = 0; tx < _WATER_DIM; tx++) {
    for (let tz = 0; tz < _WATER_DIM; tz++) {
      const wx = tx, wz = tz;  // offset so mesh starts at world (-2,-2)

      // Two overlapping sine waves per corner → gentle ripple
      const wv = (x, z) =>
        0.28
        + Math.sin(t * 1.4 + x * 0.55 + z * 0.42) * 0.04
        + Math.sin(t * 0.9 - x * 0.30 + z * 0.60) * 0.02;

      const y00 = wv(wx,   wz  );
      const y10 = wv(wx+1, wz  );
      const y11 = wv(wx+1, wz+1);
      const y01 = wv(wx,   wz+1);

      // Shallow near island centre, deep at edges
      const dist    = Math.sqrt((wx-15.5)*(wx-15.5) + (wz-15.5)*(wz-15.5));
      const shallow = Math.max(0, 1 - dist / 14);
      const r = 0.06 + shallow*0.05 + Math.sin(t*0.30 + wx*0.08)*0.01;
      const g = 0.38 + shallow*0.10 + Math.sin(t*0.50 + wz*0.08)*0.02;
      const b = 0.76 + shallow*0.07 + Math.sin(t*0.40           )*0.03;

      // Triangle 1: (wx,y00,wz) → (wx+1,y10,wz) → (wx+1,y11,wz+1)
      d[vi++]=wx;  d[vi++]=y00; d[vi++]=wz;   d[vi++]=r; d[vi++]=g; d[vi++]=b; d[vi++]=1; d[vi++]=0; d[vi++]=0;
      d[vi++]=wx+1;d[vi++]=y10; d[vi++]=wz;   d[vi++]=r; d[vi++]=g; d[vi++]=b; d[vi++]=1; d[vi++]=1; d[vi++]=0;
      d[vi++]=wx+1;d[vi++]=y11; d[vi++]=wz+1; d[vi++]=r; d[vi++]=g; d[vi++]=b; d[vi++]=1; d[vi++]=1; d[vi++]=1;
      // Triangle 2: (wx,y00,wz) → (wx+1,y11,wz+1) → (wx,y01,wz+1)
      d[vi++]=wx;  d[vi++]=y00; d[vi++]=wz;   d[vi++]=r; d[vi++]=g; d[vi++]=b; d[vi++]=1; d[vi++]=0; d[vi++]=0;
      d[vi++]=wx+1;d[vi++]=y11; d[vi++]=wz+1; d[vi++]=r; d[vi++]=g; d[vi++]=b; d[vi++]=1; d[vi++]=1; d[vi++]=1;
      d[vi++]=wx;  d[vi++]=y01; d[vi++]=wz+1; d[vi++]=r; d[vi++]=g; d[vi++]=b; d[vi++]=1; d[vi++]=0; d[vi++]=1;
    }
  }

  const id = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, id.elements);
  gl.uniform1i(u_whichTexture, -2);

  if (!g_waterBuf) g_waterBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_waterBuf);
  gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);

  const F = 4, S = 9 * F;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, S, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_Color,    4, gl.FLOAT, false, S, 3 * F);
  gl.enableVertexAttribArray(a_Color);
  gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, S, 7 * F);
  gl.enableVertexAttribArray(a_UV);

  gl.drawArrays(gl.TRIANGLES, 0, _WATER_DIM * _WATER_DIM * 6);
}

// All sprites batched into one draw call per frame.
const _SPRITE_MAX  = 600;
const g_spriteData = new Float32Array(_SPRITE_MAX * 12 * 9);
let   g_spriteBuf  = null;

function drawGrassSprites() {
  const d = g_spriteData;
  let vi = 0, sc = 0;

  for (let x = 0; x < WORLD_SIZE && sc < _SPRITE_MAX; x++) {
    for (let z = 0; z < WORLD_SIZE && sc < _SPRITE_MAX; z++) {
      const top = colHeight(x, z);
      if (top < 1 || top > 4) continue;   // only low terrain, skip towers

      // Hash-based sparsity: ~1 in 20 eligible blocks
      const h = ((x * 1361 + z * 1619) ^ (x * 7 + z * 13)) >>> 0;
      if (h % 20 !== 0) continue;

      const n     = h & 127;
      const base  = top - 0.5;              // world Y of block's top surface
      const ht    = 0.45 + (n & 3) * 0.08; // height variation 0.45–0.69
      const hw    = 0.38;                   // half-width of each quad

      // Wind sway: top vertices only, sine-wave per position + time
      const sway  = Math.sin(g_seconds * 2.0 + x * 0.6 + z * 0.4) * 0.07;

      // Per-sprite green shade
      const r = (62  + (n & 15)) / 255;
      const g = (126 + ((n >> 2) & 31)) / 255;
      const b = (25  + (n & 11)) / 255;
      const a = 1;

      // Write 2 quads (6 verts each) inline — no per-frame allocation
      // Quad layout: BL BR TR | BL TR TL
      // Quad 1 — runs along X, perpendicular to Z
      const q1 = [
        [x-hw, base,    z,    0,0],
        [x+hw, base,    z,    1,0],
        [x+hw+sway, base+ht, z,  1,1],
        [x-hw, base,    z,    0,0],
        [x+hw+sway, base+ht, z,  1,1],
        [x-hw+sway, base+ht, z,  0,1],
      ];
      // Quad 2 — runs along Z, perpendicular to X
      const q2 = [
        [x, base,    z-hw, 0,0],
        [x, base,    z+hw, 1,0],
        [x+sway, base+ht, z+hw, 1,1],
        [x, base,    z-hw, 0,0],
        [x+sway, base+ht, z+hw, 1,1],
        [x+sway, base+ht, z-hw, 0,1],
      ];
      for (const quadverts of [q1, q2]) {
        for (const [px, py, pz, u, v] of quadverts) {
          d[vi++]=px; d[vi++]=py; d[vi++]=pz;
          d[vi++]=r;  d[vi++]=g;  d[vi++]=b;  d[vi++]=a;
          d[vi++]=u;  d[vi++]=v;
        }
      }
      sc++;
    }
  }

  if (sc === 0) return;

  // Single draw call for all sprites
  const identity = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identity.elements);
  gl.uniform1i(u_whichTexture, -2);

  if (!g_spriteBuf) g_spriteBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_spriteBuf);
  gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, vi), gl.DYNAMIC_DRAW);

  const F = 4, S = 9 * F;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, S, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_Color,    4, gl.FLOAT, false, S, 3 * F);
  gl.enableVertexAttribArray(a_Color);
  gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, S, 7 * F);
  gl.enableVertexAttribArray(a_UV);

  gl.drawArrays(gl.TRIANGLES, 0, sc * 12);
}

function drawStars(nightFactor) {
  if (nightFactor < 0.02) return;
  const b = Math.min(1, nightFactor * 2.5);  // fade in quickly after sunset
  g_starCube.textureNum = -2;
  g_starCube.color = [b, b, b * 0.92, 1.0];
  for (const [sx, sy, sz] of _STARS) {
    g_starCube.matrix.setTranslate(sx, sy, sz);
    g_starCube.matrix.scale(0.28, 0.28, 0.28);
    g_starCube.render();
  }
}

// ── Sun & Moon ────────────────────────────────────────────────────────────────
// Both follow the same circular orbit; moon is exactly 180° behind the sun
// so when the sun sets the moon rises on the opposite side.
function drawSunMoon(orbit) {
  const R = 28, cx = 16, cz = 16;

  const sunX = cx + R * Math.cos(orbit),  sunY = R * Math.sin(orbit);
  const monX = cx - R * Math.cos(orbit),  monY = -R * Math.sin(orbit); // +PI offset
  const sz   = cz;

  const orb = new Cube();
  orb.textureNum = -2;

  if (sunY > -1) {   // sun above horizon
    orb.color = [1.0, 0.92, 0.12, 1.0];
    orb.matrix.setTranslate(sunX, sunY, sz);
    orb.matrix.scale(2.2, 2.2, 2.2);
    orb.render();
  }

  if (monY > -1) {   // moon above horizon
    orb.color = [0.78, 0.80, 0.88, 1.0];
    orb.matrix.setTranslate(monX, monY, sz);
    orb.matrix.scale(1.6, 1.6, 1.6);
    orb.render();
  }
}

function renderAllShapes() {
  // Sky: full blue at noon, deep navy at midnight
  const orbit       = g_seconds * 0.05;
  const sinOrbit    = Math.sin(orbit);
  const dayFactor   = Math.max(0,  sinOrbit);
  const nightFactor = Math.max(0, -sinOrbit);
  gl.clearColor(
    0.01 + 0.52 * dayFactor,
    0.01 + 0.80 * dayFactor,
    0.08 + 0.90 * dayFactor,
    1.0
  );
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  g_camera.updateViewMatrix();
  gl.uniformMatrix4fv(u_ViewMatrix,    false, g_camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectMatrix, false, g_camera.projectionMatrix.elements);

  drawStars(nightFactor);
  drawSunMoon(orbit);

  drawWater();

  // 0.07 = 0.57 (feet-to-origin offset × scale 2) − 0.5 (block-center offset)
  drawAnimal(g_pockX, g_pockFeetY + 0.07, g_pockZ, g_pockFacing);

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const top = colHeight(x, z);
      if (top === 0) continue;
      for (let y = 0; y < MAX_HEIGHT; y++) {
        if (!g_map[x][z][y]) continue;
        // Texture mode: grass (0) on the top block, stone (1) below
        let texNum = g_texMode;
        if (g_texMode === 0) texNum = (y === top - 1) ? 0 : 1;
        g_cube.color      = blockColor(x, z, y, top);
        g_cube.textureNum = texNum;
        g_cube.matrix.setTranslate(x, y, z);
        g_cube.render();
      }
    }
  }

  drawGrassSprites();

  if (g_mouseX >= 0) {
    const hover = castRay(g_mouseX, g_mouseY);
    if (hover) drawWireframe(hover.hitX, hover.hitY, hover.hitZ);
  }
}
