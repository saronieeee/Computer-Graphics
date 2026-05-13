class Cylinder {
  constructor() {
    this.type       = 'cylinder';
    this.color      = [1.0, 1.0, 1.0, 1.0];
    this.textureNum = -2;
    this.matrix     = new Matrix4();
  }

  render() {
    const [r, g, b, a] = this.color;
    const SEG = 12;
    const FLOATS_PER_VERTEX = 9;  // xyz rgba uv  (matches Cube's interleaved layout)
    const data = new Float32Array(SEG * 12 * FLOATS_PER_VERTEX);
    let idx = 0;

    const push = (x, y, z, cr, cg, cb, u, v) => {
      data[idx++] = x;  data[idx++] = y;  data[idx++] = z;
      data[idx++] = cr; data[idx++] = cg; data[idx++] = cb; data[idx++] = a;
      data[idx++] = u;  data[idx++] = v;
    };

    for (let i = 0; i < SEG; i++) {
      const ang1 = (i     / SEG) * Math.PI * 2;
      const ang2 = ((i+1) / SEG) * Math.PI * 2;
      const x1 = Math.cos(ang1) * 0.5, z1 = Math.sin(ang1) * 0.5;
      const x2 = Math.cos(ang2) * 0.5, z2 = Math.sin(ang2) * 0.5;
      const u1 = i / SEG, u2 = (i+1) / SEG;

      // Top cap (y = 0.5) — full brightness
      push(0,  0.5, 0,  r,        g,        b,        0.5,          0.5);
      push(x1, 0.5, z1, r,        g,        b,        0.5+x1*0.5,  0.5+z1*0.5);
      push(x2, 0.5, z2, r,        g,        b,        0.5+x2*0.5,  0.5+z2*0.5);

      // Bottom cap (y = -0.5) — darker
      push(0,  -0.5, 0,  r*0.7, g*0.7, b*0.7, 0.5,         0.5);
      push(x2, -0.5, z2, r*0.7, g*0.7, b*0.7, 0.5+x2*0.5,  0.5+z2*0.5);
      push(x1, -0.5, z1, r*0.7, g*0.7, b*0.7, 0.5+x1*0.5,  0.5+z1*0.5);

      // Side — two triangles per segment
      push(x1,  0.5, z1, r*0.85, g*0.85, b*0.85, u1, 1);
      push(x1, -0.5, z1, r*0.85, g*0.85, b*0.85, u1, 0);
      push(x2, -0.5, z2, r*0.85, g*0.85, b*0.85, u2, 0);

      push(x1,  0.5, z1, r*0.85, g*0.85, b*0.85, u1, 1);
      push(x2, -0.5, z2, r*0.85, g*0.85, b*0.85, u2, 0);
      push(x2,  0.5, z2, r*0.85, g*0.85, b*0.85, u2, 1);
    }

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    gl.uniform1i(u_whichTexture, this.textureNum);

    const FSIZE  = data.BYTES_PER_ELEMENT;
    const STRIDE = FLOATS_PER_VERTEX * FSIZE;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_Color,    4, gl.FLOAT, false, STRIDE, 3 * FSIZE);
    gl.enableVertexAttribArray(a_Color);
    gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, STRIDE, 7 * FSIZE);
    gl.enableVertexAttribArray(a_UV);

    gl.drawArrays(gl.TRIANGLES, 0, SEG * 12);
  }
}
