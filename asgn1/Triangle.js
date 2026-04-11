/**
 * Represents a drawable triangle shape.
 */
class Triangle {
  /**
   * Creates a triangle with default type, position, color, and size.
   */
  constructor() {
    this.type = 'triangle';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.size = 5.0;
  }

  /**
   * Renders this triangle to the current WebGL canvas.
   */
  render() {
    const xy = this.position;
    const rgba = this.color;
    const size = this.size;
    // Convert the UI size into a small clip-space offset for the triangle vertices.
    const d = size / 200.0;

    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
    gl.uniform1f(u_Size, size);

    drawTriangle([xy[0], xy[1], xy[0] + d, xy[1], xy[0], xy[1] + d]);
  }
}

/**
 * Draws one triangle from a flat list of x/y vertex coordinates.
 * @param {number[]} vertices - Six numbers representing three 2D vertices.
 */
function drawTriangle(vertices) {
  const n = 3;

  // Create a buffer object
  const vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }

  // Bind the buffer object to target
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  // Write data into the buffer object
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

  // Assign the buffer object to a_Position variable
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);

  // Enable the assignment to a_Position variable
  gl.enableVertexAttribArray(a_Position);

  gl.drawArrays(gl.TRIANGLES, 0, n);
}
