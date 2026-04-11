// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }
`;

// Fragment shader program
const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// Global WebGL-related variables
let canvas;
let gl;
let a_Position;
let u_FragColor;
let u_Size;

const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;

/**
 * Gets the canvas element and initializes the WebGL context.
 * @returns {boolean} True if WebGL was created successfully; otherwise false.
 */
function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  gl = WebGLUtils.setupWebGL(canvas, { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return false;
  }

  return true;
}

/**
 * Compiles the shaders and connects JavaScript handles to GLSL variables.
 * @returns {boolean} True if all shader variables were connected; otherwise false.
 */
function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return false;
  }

  // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return false;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return false;
  }

  // Get the storage location of u_Size
  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if (!u_Size) {
    console.log('Failed to get the storage location of u_Size');
    return false;
  }

  return true;
}

/**
 * Connects HTML buttons and sliders to the app's current drawing state.
 */
function addActionsForHtmlUI() {
  document.getElementById('green').onclick = function() {
    g_selectedColor = [0.0, 1.0, 0.0, 1.0];
  };

  document.getElementById('red').onclick = function() {
    g_selectedColor = [1.0, 0.0, 0.0, 1.0];
  };

  document.getElementById('pointButton').onclick = function() {
    g_selectedType = POINT;
  };

  document.getElementById('triButton').onclick = function() {
    g_selectedType = TRIANGLE;
  };

  document.getElementById('circleButton').onclick = function() {
    g_selectedType = CIRCLE;
  };

  document.getElementById('clearButton').onclick = function() {
    g_shapesList = [];
    renderAllShapes();
  };

  document.getElementById('redSlide').addEventListener('mouseup', function() {
    g_selectedColor[0] = this.value / 100;
  });

  document.getElementById('greenSlide').addEventListener('mouseup', function() {
    g_selectedColor[1] = this.value / 100;
  });

  document.getElementById('blueSlide').addEventListener('mouseup', function() {
    g_selectedColor[2] = this.value / 100;
  });

  document.getElementById('sizeSlide').addEventListener('mouseup', function() {
    g_selectedSize = Number(this.value);
  });
}

/**
 * Initializes WebGL, hooks up the UI, and prepares the canvas for drawing.
 */
function main() {
  if (!setupWebGL()) {
    return;
  }

  if (!connectVariablesToGLSL()) {
    return;
  }

  addActionsForHtmlUI();

  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) {
    if (ev.buttons == 1) {
      click(ev);
    }
  };

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);
}

let g_shapesList = [];

// Globals related to UI elements
let g_selectedColor = [1.0, 1.0, 1.0, 1.0];
let g_selectedSize = 10.0;
let g_selectedType = POINT;

/**
 * Clears the canvas and renders every shape currently stored in `g_shapesList`.
 */
function renderAllShapes() {
  const startTime = performance.now();

  // Clear <canvas> and redraw every saved shape from the current scene list.
  gl.clear(gl.COLOR_BUFFER_BIT);

  const len = g_shapesList.length;
  for (let i = 0; i < len; i++) {
    g_shapesList[i].render();
  }

  const duration = performance.now() - startTime;
  const fps = duration > 0 ? Math.floor(10000 / duration) / 10 : 0;
  sendTextToHTML('numdot: ' + len + ' ms: ' + Math.floor(duration) + ' fps: ' + fps, 'numdot');
}

/**
 * Updates the inner HTML of an element on the page.
 * @param {string} text - The text to display.
 * @param {string} htmlID - The id of the HTML element to update.
 */
function sendTextToHTML(text, htmlID) {
  const htmlElm = document.getElementById(htmlID);
  if (!htmlElm) {
    console.log('Failed to get ' + htmlID + ' from HTML');
    return;
  }
  htmlElm.innerHTML = text;
}

/**
 * Handles a canvas click or drag event by creating the currently selected shape.
 * @param {MouseEvent} ev - The mouse event generated by the canvas.
 */
function click(ev) {
  let x = ev.clientX; // x coordinate of a mouse pointer
  let y = ev.clientY; // y coordinate of a mouse pointer
  const rect = ev.target.getBoundingClientRect();

  // Convert browser pixel coordinates into WebGL clip-space coordinates [-1, 1].
  x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);

  let shape;
  if (g_selectedType === POINT) {
    shape = new Point();
  } else if (g_selectedType === TRIANGLE) {
    shape = new Triangle();
  } else {
    shape = new Circle();
  }

  shape.position = [x, y];
  shape.color = g_selectedColor.slice();
  shape.size = g_selectedSize;
  g_shapesList.push(shape);

  renderAllShapes();
}
