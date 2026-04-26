// Vertex shader program
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  varying vec4 v_Color;
  void main() {
    gl_Position = u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_Color = a_Color;
  }
`;

// Fragment shader program
const FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;
  void main() {
    gl_FragColor = v_Color;
  }
`;

let canvas;
let gl;
let a_Position;
let a_Color;
let u_ModelMatrix;
let u_GlobalRotateMatrix;

/**
 * Sets up the WebGL rendering context from the canvas element.
 * Enables depth testing for proper 3D rendering.
 * @returns {boolean} True if WebGL setup was successful, false otherwise.
 */
function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return false;
  }
  gl.enable(gl.DEPTH_TEST);
  return true;
}

/**
 * Initializes vertex and fragment shaders, then retrieves the locations
 * of shader variables (attributes and uniforms) needed for rendering.
 * @returns {boolean} True if shaders were initialized successfully, false otherwise.
 */
function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return false;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return false;
  }

  a_Color = gl.getAttribLocation(gl.program, 'a_Color');
  if (a_Color < 0) {
    console.log('Failed to get the storage location of a_Color');
    return false;
  }

  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return false;
  }

  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if (!u_GlobalRotateMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotateMatrix');
    return false;
  }

  return true;
}

/**
 * Binds HTML UI elements (buttons and sliders) to their corresponding
 * animation variables and event handlers.
 */
function addActionsForHtmlUI() {
  document.getElementById('playAllButton').onclick = function() {
    g_yellowAnimation = g_magentaAnimation = g_featherAnimation = true;
  };
  document.getElementById('stopAllButton').onclick = function() {
    g_yellowAnimation = g_magentaAnimation = g_featherAnimation = false;
  };

  document.getElementById('yellowOnButton').onclick  = function() { g_yellowAnimation  = true;  };
  document.getElementById('yellowOffButton').onclick = function() { g_yellowAnimation  = false; };
  document.getElementById('magentaOnButton').onclick  = function() { g_magentaAnimation = true;  };
  document.getElementById('magentaOffButton').onclick = function() { g_magentaAnimation = false; };

  document.getElementById('angleSlide').addEventListener('mousemove', function() {
    g_globalAngle = Number(this.value);
    renderAllShapes();
  });

  document.getElementById('yellowAngleSlide').addEventListener('mousemove', function() {
    g_yellowAngle = Number(this.value);
    renderAllShapes();
  });

  document.getElementById('magentaAngleSlide').addEventListener('mousemove', function() {
    g_magentaAngle = Number(this.value);
    renderAllShapes();
  });

  document.getElementById('featherOnButton').onclick  = function() { g_featherAnimation = true;  };
  document.getElementById('featherOffButton').onclick = function() { g_featherAnimation = false; };

  document.getElementById('featherAngleSlide').addEventListener('mousemove', function() {
    g_featherAngle = Number(this.value);
    renderAllShapes();
  });

  document.getElementById('beakAngleSlide').addEventListener('mousemove', function() {
    g_beakAngle = Number(this.value);
    renderAllShapes();
  });

  document.getElementById('beakOnButton').onclick  = function() { g_beakAnimation = true;  };
  document.getElementById('beakOffButton').onclick = function() { g_beakAnimation = false; };
}

/**
 * Main entry point. Initializes WebGL, shaders, UI handlers, and mouse
 * controls. Starts the animation loop.
 */
function main() {
  if (!setupWebGL()) return;
  if (!connectVariablesToGLSL()) return;

  addActionsForHtmlUI();

  canvas.onmousedown = function(ev) {
    g_isDragging = true;
    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;

    // Trigger poke animation on shift+click
    if (ev.shiftKey) {
      g_pokeTimer = 60;  // ~1 second at 60fps
    }
  };
  canvas.onmouseup   = function()    { g_isDragging = false; };
  canvas.onmouseleave = function()   { g_isDragging = false; };
  canvas.onmousemove = function(ev) {
    if (!g_isDragging) return;
    g_globalAngle  -= (ev.clientX - g_lastMouseX) * 0.5;
    g_globalAngleX -= (ev.clientY - g_lastMouseY) * 0.5;
    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;
  };

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  requestAnimationFrame(tick);
}

let g_globalAngle  = 0;
let g_globalAngleX = 0;
let g_isDragging   = false;
let g_lastMouseX   = 0;
let g_lastMouseY   = 0;
let g_yellowAngle = 0;
let g_magentaAngle = 0;
let g_yellowAnimation  = false;
let g_magentaAnimation = false;
let g_featherAngle     = 15;
let g_featherAnimation = false;
let g_beakAngle        = 3;
let g_beakAnimation    = false;
let g_pokeTimer        = 0;  // time remaining for poke animation
let g_pokeEyeScale     = 1;   // eye scale during poke
let g_pokeWingAngle    = 0;  // wing angle during poke
let g_pokeBeakOpen     = 0;  // beak open amount during poke
let g_pokeBodyY        = 0;  // body jump height during poke
let g_wingFlap = 0;
let g_bodyZ    = 0;
let g_startTime     = performance.now() / 1000;
let g_seconds       = 0;
let g_lastFrameTime = performance.now();

/**
 * Updates all animation angles based on current time and animation states.
 * Handles continuous animations (wing flap, body sway) and triggered animations
 * (leg swing, head bend, feather spread, beak open, poke reaction).
 */
function updateAnimationAngles() {
  if (g_yellowAnimation)  g_yellowAngle  = 30 * Math.sin(g_seconds * 1.5);
  if (g_magentaAnimation) g_magentaAngle = 18 * Math.sin(g_seconds * 0.9);
  if (g_featherAnimation) g_featherAngle = 12 + 13 * Math.abs(Math.sin(g_seconds * 0.3));
  g_wingFlap = 10 * Math.sin(g_seconds * 2.0);         // always-on: ±10° flap
  g_bodyZ    = 0.02 * Math.sin(g_seconds * 1.2);       // always-on: sway ±0.06 in Z
  if (g_beakAnimation) g_beakAnimation = g_beakAngle * Math.sin(g_seconds * 4.0);

  // Update poke animation
  if (g_pokeTimer > 0) {
    g_pokeTimer--;
    const t = g_pokeTimer / 60;  // normalized time 0-1
    const shake = Math.sin(g_pokeTimer * 0.5) * 0.1;  // shake oscillation
    g_pokeEyeScale = 1 + 1.5 * Math.sin(t * Math.PI);  // eyes grow big then shrink
    g_pokeWingAngle = 60 * Math.sin(t * Math.PI);      // wings fly up
    g_pokeBeakOpen = 8 * Math.sin(t * Math.PI);        // beak opens wide
    g_pokeBodyY = 0.15 * Math.sin(t * Math.PI) + shake;  // jump up with shake
  } else {
    g_pokeEyeScale = 1;
    g_pokeWingAngle = 0;
    g_pokeBeakOpen = 0;
    g_pokeBodyY = 0;
  }
}

/**
 * Animation loop callback. Calculates FPS, updates animation angles,
 * renders the scene, and schedules the next frame.
 */
function tick() {
  const now = performance.now();
  const fps = Math.round(1000 / (now - g_lastFrameTime));
  g_lastFrameTime = now;

  g_seconds = now / 1000 - g_startTime;
  updateAnimationAngles();

  const renderStart = performance.now();
  renderAllShapes();
  const renderMs = (performance.now() - renderStart).toFixed(2);

  document.getElementById('fps').innerHTML =
    'FPS: ' + fps + '&nbsp;&nbsp;|&nbsp;&nbsp;render: ' + renderMs + ' ms';

  requestAnimationFrame(tick);
}

/**
 * Renders the complete blocky animal scene. Clears the canvas, applies
 * global camera rotation, then draws all body parts in hierarchical order:
 * body → neck → head → beak → eyes → tail → wings → legs.
 * @returns {void}
 */
function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const globalRotMat = new Matrix4();
  globalRotMat.setRotate(g_globalAngle, 0, 1, 0);
  globalRotMat.rotate(g_globalAngleX, 1, 0, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  // ── BODY (1) ─────────────────────────────────────────────────────────
  const body = new Cube();
  body.color = [0.05, 0.35, 0.60, 1.0];
  body.matrix.setIdentity();
  body.matrix.translate(0.0, 0.15 + g_pokeBodyY, g_bodyZ);  // add poke jump
  const bodyCoord = new Matrix4(body.matrix); // saved before scale for chain attachments
  body.matrix.scale(0.55, 0.22, 0.28);
  body.render();

  // ── NECK (2) — 1st link of neck chain ────────────────────────────────
  const neck = new Cube();
  neck.color = [0.0, 0.55, 0.48, 1.0];
  neck.matrix = new Matrix4(bodyCoord);
  neck.matrix.translate(0.22, 0.14, 0.0);
  neck.matrix.rotate(-15, 0, 0, 1);
  neck.matrix.rotate(g_magentaAngle, 0, 1, 0);
  const neckCoord = new Matrix4(neck.matrix);
  neck.matrix.scale(0.1, 0.3, 0.1);
  neck.render();

  // ── HEAD (3) — 2nd link ───────────────────────────────────────────────
  const head = new Cube();
  head.color = [0.1, 0.45, 0.78, 1.0];
  head.matrix = new Matrix4(neckCoord);
  head.matrix.translate(0.04, 0.28, 0.0);
  const headCoord = new Matrix4(head.matrix);
  head.matrix.scale(0.2, 0.16, 0.18);
  head.render();

  // ── BEAK (4) — 3rd link (chain: body→neck→head→beak = 4 deep) ────────
  const beak = new Cube();
  beak.color = [0.9, 0.78, 0.15, 1.0];
  beak.matrix = new Matrix4(headCoord);
  beak.matrix.translate(0.13, -0.02, 0.0);
  beak.matrix.rotate(g_beakAnimation + g_pokeBeakOpen, 0, 0, 1);  // add poke beak open
  const beakCoord = new Matrix4(beak.matrix);
  beak.matrix.scale(0.1, 0.05, 0.07);
  beak.render();

  // ── BEAK TIP (5) — animated lower jaw ────────────────────────────────
  const beakTip = new Cube();
  beakTip.color = [0.85, 0.70, 0.1, 1.0];
  beakTip.matrix = new Matrix4(beakCoord);
  beakTip.matrix.translate(0, -0.04, 0.0);  // positioned below the base
  beakTip.matrix.rotate(g_beakAnimation, 0, 0, 1);  // rotate down to open mouth
  beakTip.matrix.scale(0.08, 0.03, 0.05);
  beakTip.render();

  // ── EYES — cylinder discs on each side of the head ───────────────────
  for (const side of [-1, 1]) {
    const eye = new Cylinder();
    eye.color = [0.05, 0.05, 0.08, 1.0];
    eye.matrix = new Matrix4(headCoord);
    eye.matrix.translate(0.03, 0.02, side * 0.09);
    eye.matrix.rotate(90, 1, 0, 0);   // rotate axis so flat face points outward in Z
    eye.matrix.scale(0.04 * g_pokeEyeScale, 0.015 * g_pokeEyeScale, 0.04 * g_pokeEyeScale);  // add poke eye scale
    eye.render();

    // White pupil when scared (poke) - scales with eye
    if (g_pokeTimer > 0) {
      const pupil = new Cylinder();
      pupil.color = [1.0, 1.0, 1.0, 1.0];
      pupil.matrix = new Matrix4(headCoord);
      pupil.matrix.translate(0.035, 0.02, side * 0.095);
      pupil.matrix.rotate(90, 1, 0, 0);
      // Smaller base but still grows proportionally with eye
      pupil.matrix.scale(0.02 * g_pokeEyeScale, 0.04 * g_pokeEyeScale, 0.02 * g_pokeEyeScale);
      pupil.render();
    }
  }

  // ── TAIL BASE (8) ─────────────────────────────────────────────────────
  const tailBase = new Cube();
  tailBase.color = [0.0, 0.48, 0.28, 1.0];
  tailBase.matrix = new Matrix4(bodyCoord);
  tailBase.matrix.translate(-0.2, 0.06, 0.0);
  tailBase.matrix.rotate(0, 0, 1, 0);  // angle base slightly behind the body
  const tailCoord = new Matrix4(tailBase.matrix);
  tailBase.matrix.scale(0.22, 0.12, 0.2);
  tailBase.render();

  // ── TAIL FEATHERS (9–17) — nine feathers fanning out ─────────────────
  const featherColors = [
    [0.0,  0.55, 0.9,  1.0],
    [0.85, 0.75, 0.0,  1.0],
    [0.15, 0.75, 0.2,  1.0],
    [0.0,  0.55, 0.9,  1.0],
    [0.15, 0.75, 0.2,  1.0],
    [0.0,  0.55, 0.9,  1.0],
    [0.15, 0.75, 0.2,  1.0],
    [0.85, 0.75, 0.0,  1.0],
    [0.0,  0.55, 0.9,  1.0],
  ];
  for (let i = 0; i < 9; i++) {
    const feather = new Cube();
    feather.color = featherColors[i];
    feather.matrix = new Matrix4(tailCoord);
    feather.matrix.rotate((i - 4) * g_featherAngle, 1, 0, 0);
    feather.matrix.translate(0.0, 0.52, 0.0);
    feather.matrix.scale(0.05, 0.62, 0.05);
    feather.render();
  }

  // ── WINGS (16, 17) — one per side, flared slightly outward ───────────
  for (const side of [-1, 1]) {
    const wing = new Cube();
    wing.color = [0.02, 0.30, 0.55, 1.0];
    wing.matrix = new Matrix4(bodyCoord);
    wing.matrix.translate(0.0, 0.0, side * 0.17);
    wing.matrix.rotate(side * (20 - g_wingFlap + g_pokeWingAngle), 1, 0, 0);  // add poke wing angle
    wing.matrix.scale(0.45, 0.07, 0.12);
    wing.render();
  }

  // ── LEFT LEG CHAIN (18→19→20): upper→lower→foot ──────────────────────
  const leftUpper = new Cube();
  leftUpper.color = [0.58, 0.50, 0.38, 1.0];
  leftUpper.matrix = new Matrix4(bodyCoord);
  leftUpper.matrix.translate(-0.1, -0.2, -0.08);
  leftUpper.matrix.rotate(g_yellowAngle, 0, 0, 1);  // Z axis → swings in XY (visible walk stride)
  const leftUpperCoord = new Matrix4(leftUpper.matrix);
  leftUpper.matrix.scale(0.08, 0.24, 0.08);
  leftUpper.render();

  const leftLower = new Cube();
  leftLower.color = [0.50, 0.43, 0.32, 1.0];
  leftLower.matrix = new Matrix4(leftUpperCoord);
  leftLower.matrix.translate(0.0, -0.12, 0.0);
  leftLower.matrix.rotate(30, 0, 0, 1);  // static forward knee bend, same axis
  const leftLowerCoord = new Matrix4(leftLower.matrix);
  leftLower.matrix.scale(0.07, 0.20, 0.07);
  leftLower.render();

  const leftFoot = new Cube();
  leftFoot.color = [0.42, 0.36, 0.26, 1.0];
  leftFoot.matrix = new Matrix4(leftLowerCoord);
  leftFoot.matrix.translate(0.06, -0.10, 0.0);  // extends forward in X to match walk direction
  leftFoot.matrix.rotate(-20, 0, 0, 1);
  leftFoot.matrix.scale(0.15, 0.03, 0.08);
  leftFoot.render();

  // ── RIGHT LEG CHAIN (21→22→23): mirrors left with slight phase offset ─
  const rightUpper = new Cube();
  rightUpper.color = [0.58, 0.50, 0.38, 1.0];
  rightUpper.matrix = new Matrix4(bodyCoord);
  rightUpper.matrix.translate(-0.1, -0.2, 0.08);
  rightUpper.matrix.rotate(-g_yellowAngle * 0.8, 0, 0, 1);  // opposite phase
  const rightUpperCoord = new Matrix4(rightUpper.matrix);
  rightUpper.matrix.scale(0.08, 0.24, 0.08);
  rightUpper.render();

  const rightLower = new Cube();
  rightLower.color = [0.50, 0.43, 0.32, 1.0];
  rightLower.matrix = new Matrix4(rightUpperCoord);
  rightLower.matrix.translate(0.0, -0.12, 0.0);
  rightLower.matrix.rotate(30, 0, 0, 1);
  const rightLowerCoord = new Matrix4(rightLower.matrix);
  rightLower.matrix.scale(0.07, 0.20, 0.07);
  rightLower.render();

  const rightFoot = new Cube();
  rightFoot.color = [0.42, 0.36, 0.26, 1.0];
  rightFoot.matrix = new Matrix4(rightLowerCoord);
  rightFoot.matrix.translate(0.06, -0.10, 0.0);
  rightFoot.matrix.rotate(-20, 0, 0, 1);
  rightFoot.matrix.scale(0.15, 0.03, 0.08);
  rightFoot.render();
}
