// asg0.js (c) 2012 matsuda
let canvas;
let ctx;

function main() {
  // retrieve <canvas> element
  canvas = document.getElementById('webgl');
  if (!canvas) {
    console.log('Failed to retrieve the canvas element');
    return;
  }

  // use the 2D canvas API
  ctx = canvas.getContext('2d');

  // draw the default vectors once when the page first loads
  handleDrawEvent();
}

function clearCanvas() {
  // repaint canvas black to clear it
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawVector(v, color) {
  // scale the vector so it is easier to see on the canvas
  const scale = 20;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  // start at the center of the canvas.
  ctx.moveTo(canvas.width / 2, canvas.height / 2);

  // positive y should go upward, so subtract from canvas y
  ctx.lineTo(
    canvas.width / 2 + v.elements[0] * scale,
    canvas.height / 2 - v.elements[1] * scale
  );

  ctx.stroke();
}

function readVector(xId, yId) {
  // read x and y from the input boxes, blank input becomes 0
  const x = parseFloat(document.getElementById(xId).value) || 0;
  const y = parseFloat(document.getElementById(yId).value) || 0;
  return new Vector3([x, y, 0]);
}

function handleDrawEvent() {
  // clear and redraw the two user vectors
  clearCanvas();

  const v1 = readVector('v1x', 'v1y');
  const v2 = readVector('v2x', 'v2y');

  drawVector(v1, 'red');
  drawVector(v2, 'blue');
}

function handleDrawOperationEvent() {
  // first show the original two vectors
  clearCanvas();

  const v1 = readVector('v1x', 'v1y');
  const v2 = readVector('v2x', 'v2y');
  const operation = document.getElementById('operation').value;
  const scalar = parseFloat(document.getElementById('scalar').value) || 0;

  drawVector(v1, 'red');
  drawVector(v2, 'blue');

  // perform selected operation from the dropdown
  switch (operation) {
    case 'add': {
      const v3 = new Vector3(v1.elements);
      v3.add(v2);
      drawVector(v3, 'green');
      break;
    }
    case 'sub': {
      const v3 = new Vector3(v1.elements);
      v3.sub(v2);
      drawVector(v3, 'green');
      break;
    }
    case 'mul': {
      const v3 = new Vector3(v1.elements);
      const v4 = new Vector3(v2.elements);
      v3.mul(scalar);
      v4.mul(scalar);
      drawVector(v3, 'green');
      drawVector(v4, 'green');
      break;
    }
    case 'div': {
      if (scalar === 0) {
        console.log('Cannot divide by zero.');
        return;
      }
      const v3 = new Vector3(v1.elements);
      const v4 = new Vector3(v2.elements);
      v3.div(scalar);
      v4.div(scalar);
      drawVector(v3, 'green');
      drawVector(v4, 'green');
      break;
    }
    case 'magnitude':
      // magnitude is printed to console
      console.log('Magnitude of v1:', v1.magnitude());
      console.log('Magnitude of v2:', v2.magnitude());
      break;
    case 'normalize': {
      const v3 = new Vector3(v1.elements);
      const v4 = new Vector3(v2.elements);
      v3.normalize();
      v4.normalize();
      drawVector(v3, 'green');
      drawVector(v4, 'green');
      break;
    }
    case 'angle':
      console.log('Angle between v1 and v2:', angleBetween(v1, v2), 'degrees');
      break;
    case 'area':
      console.log('Area of the triangle:', areaTriangle(v1, v2));
      break;
  }
}

function angleBetween(v1, v2) {
  // dot(v1, v2) = |v1| |v2| cos(theta)
  const mags = v1.magnitude() * v2.magnitude();
  if (mags === 0) {
    return 0;
  }

  let cosine = Vector3.dot(v1, v2) / mags;
  cosine = Math.max(-1, Math.min(1, cosine));
  return Math.acos(cosine) * 180 / Math.PI;
}

function areaTriangle(v1, v2) {
  // triangle area is half the magnitude of the cross product
  return Vector3.cross(v1, v2).magnitude() / 2;
}
