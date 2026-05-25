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
    const FLOATS_PER_VERTEX = 12;  // xyz rgba uv nxyz
    const data = new Float32Array(SEG * 12 * FLOATS_PER_VERTEX);
    let idx = 0;

    const push = (x, y, z, cr, cg, cb, u, v, nx, ny, nz) => {
      data[idx++] = x;  data[idx++] = y;  data[idx++] = z;
      data[idx++] = cr; data[idx++] = cg; data[idx++] = cb; data[idx++] = a;
      data[idx++] = u;  data[idx++] = v;
      data[idx++] = nx; data[idx++] = ny; data[idx++] = nz;
    };

    for (let i = 0; i < SEG; i++) {
      const ang1 = (i     / SEG) * Math.PI * 2;
      const ang2 = ((i+1) / SEG) * Math.PI * 2;
      const x1 = Math.cos(ang1) * 0.5, z1 = Math.sin(ang1) * 0.5;
      const x2 = Math.cos(ang2) * 0.5, z2 = Math.sin(ang2) * 0.5;
      // outward side normals (unit length, radius=0.5 so multiply by 2)
      const sn1x = Math.cos(ang1), sn1z = Math.sin(ang1);
      const sn2x = Math.cos(ang2), sn2z = Math.sin(ang2);
      const u1 = i / SEG, u2 = (i+1) / SEG;

      // Top cap (y = 0.5) — full brightness, normal up
      push(0,  0.5, 0,  r,        g,        b,        0.5,          0.5,          0, 1, 0);
      push(x1, 0.5, z1, r,        g,        b,        0.5+x1*0.5,  0.5+z1*0.5,   0, 1, 0);
      push(x2, 0.5, z2, r,        g,        b,        0.5+x2*0.5,  0.5+z2*0.5,   0, 1, 0);

      // Bottom cap (y = -0.5) — darker, normal down
      push(0,  -0.5, 0,  r*0.7, g*0.7, b*0.7, 0.5,         0.5,          0, -1, 0);
      push(x2, -0.5, z2, r*0.7, g*0.7, b*0.7, 0.5+x2*0.5,  0.5+z2*0.5,  0, -1, 0);
      push(x1, -0.5, z1, r*0.7, g*0.7, b*0.7, 0.5+x1*0.5,  0.5+z1*0.5,  0, -1, 0);

      // Side — two triangles per segment, outward normals per vertex
      push(x1,  0.5, z1, r*0.85, g*0.85, b*0.85, u1, 1, sn1x, 0, sn1z);
      push(x1, -0.5, z1, r*0.85, g*0.85, b*0.85, u1, 0, sn1x, 0, sn1z);
      push(x2, -0.5, z2, r*0.85, g*0.85, b*0.85, u2, 0, sn2x, 0, sn2z);

      push(x1,  0.5, z1, r*0.85, g*0.85, b*0.85, u1, 1, sn1x, 0, sn1z);
      push(x2, -0.5, z2, r*0.85, g*0.85, b*0.85, u2, 0, sn2x, 0, sn2z);
      push(x2,  0.5, z2, r*0.85, g*0.85, b*0.85, u2, 1, sn2x, 0, sn2z);
    }

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    gl.uniform1i(u_whichTexture, this.textureNum);

    // Normal matrix = inverse-transpose of model matrix upper-left 3×3
    _nm4.set(this.matrix);
    _nm4.invert().transpose();
    const e = _nm4.elements;
    _nm3[0]=e[0]; _nm3[1]=e[1]; _nm3[2]=e[2];
    _nm3[3]=e[4]; _nm3[4]=e[5]; _nm3[5]=e[6];
    _nm3[6]=e[8]; _nm3[7]=e[9]; _nm3[8]=e[10];
    gl.uniformMatrix3fv(u_NormalMatrix, false, _nm3);

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
    gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 9 * FSIZE);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, SEG * 12);
  }
}
