class Cube {
  constructor() {
    this.type = 'cube';
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
  }

  render() {
    const [r, g, b, a] = this.color;

    // Per-face brightness for fake lighting
    const faces = [
      { verts: [ // Front (z=0.5)
        -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5,
        -0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5], brightness: 1.0 },
      { verts: [ // Top (y=0.5)
        -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
        -0.5, 0.5,-0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5], brightness: 0.9 },
      { verts: [ // Right (x=0.5)
         0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,
         0.5,-0.5, 0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5], brightness: 0.8 },
      { verts: [ // Left (x=-0.5)
        -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5,
        -0.5,-0.5,-0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5], brightness: 0.7 },
      { verts: [ // Bottom (y=-0.5)
        -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5,-0.5,-0.5,
        -0.5,-0.5, 0.5,  0.5,-0.5,-0.5, -0.5,-0.5,-0.5], brightness: 0.6 },
      { verts: [ // Back (z=-0.5)
         0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,
         0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5], brightness: 0.5 },
    ];

    // Build one interleaved array: [x,y,z, r,g,b,a,  x,y,z, r,g,b,a, ...]
    // 36 vertices × 7 floats = 252 floats total
    const FLOATS_PER_VERTEX = 7;
    const data = new Float32Array(36 * FLOATS_PER_VERTEX);
    let idx = 0;
    for (const face of faces) {
      const fr = r * face.brightness;
      const fg = g * face.brightness;
      const fb = b * face.brightness;
      for (let v = 0; v < 18; v += 3) {
        data[idx++] = face.verts[v];
        data[idx++] = face.verts[v + 1];
        data[idx++] = face.verts[v + 2];
        data[idx++] = fr;
        data[idx++] = fg;
        data[idx++] = fb;
        data[idx++] = a;
      }
    }

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    const FSIZE = data.BYTES_PER_ELEMENT;
    const STRIDE = FLOATS_PER_VERTEX * FSIZE;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    // Position: first 3 floats of each vertex
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(a_Position);

    // Color: last 4 floats of each vertex
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, STRIDE, 3 * FSIZE);
    gl.enableVertexAttribArray(a_Color);

    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
}
