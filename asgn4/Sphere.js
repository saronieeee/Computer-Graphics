const _SPHERE_STACKS = 12;
const _SPHERE_SLICES = 24;

// Pre-built geometry computed once at load time — no GL calls needed.
// Layout per vertex: pos(x,y,z) normal(nx,ny,nz) uv(u,v) — 8 floats.
// Sphere is centered at origin with radius 0.5 to match Cube's unit-size convention.
// On a sphere at the origin, normal == normalize(position), so normal = position * 2.
const _SPHERE_GEO = (() => {
  const VERTS = _SPHERE_STACKS * _SPHERE_SLICES * 6;
  const data  = new Float32Array(VERTS * 8);
  let idx = 0;

  const vert = (phi, theta) => {
    const sp = Math.sin(phi), cp = Math.cos(phi);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const nx = sp * ct, ny = cp, nz = sp * st;
    data[idx++] = nx * 0.5;               // x
    data[idx++] = ny * 0.5;               // y
    data[idx++] = nz * 0.5;               // z
    data[idx++] = nx;                      // nx (unit length)
    data[idx++] = ny;                      // ny
    data[idx++] = nz;                      // nz
    data[idx++] = theta / (Math.PI * 2);  // u
    data[idx++] = phi   / Math.PI;        // v
  };

  for (let i = 0; i < _SPHERE_STACKS; i++) {
    const phi1 = (i       / _SPHERE_STACKS) * Math.PI;
    const phi2 = ((i + 1) / _SPHERE_STACKS) * Math.PI;
    for (let j = 0; j < _SPHERE_SLICES; j++) {
      const t1 = (j       / _SPHERE_SLICES) * Math.PI * 2;
      const t2 = ((j + 1) / _SPHERE_SLICES) * Math.PI * 2;
      // Two CCW triangles per quad (viewed from outside)
      vert(phi1, t1); vert(phi2, t1); vert(phi2, t2);
      vert(phi1, t1); vert(phi2, t2); vert(phi1, t2);
    }
  }
  return data;
})();

class Sphere {
  constructor() {
    this.type       = 'sphere';
    this.color      = [1.0, 1.0, 1.0, 1.0];
    this.textureNum = -2;
    this.matrix     = new Matrix4();
    this._buf       = null;
    // 36 bytes per vertex: xyz(3) + rgba(4) + uv(2) + nxyz(3) = 12 floats
    this.verts32    = new Float32Array(_SPHERE_STACKS * _SPHERE_SLICES * 6 * 12);
  }

  render() {
    const [r, g, b, a] = this.color;
    const v    = this.verts32;
    const geo  = _SPHERE_GEO;
    const VERTS = _SPHERE_STACKS * _SPHERE_SLICES * 6;

    for (let i = 0; i < VERTS; i++) {
      const gi = i * 8;   // source index in geo (8 floats: xyz nxyz uv)
      const vi = i * 12;  // dest index in verts32 (12 floats: xyz rgba uv nxyz)
      v[vi    ] = geo[gi    ];  // x
      v[vi + 1] = geo[gi + 1];  // y
      v[vi + 2] = geo[gi + 2];  // z
      v[vi + 3] = r;             // r
      v[vi + 4] = g;             // g
      v[vi + 5] = b;             // b
      v[vi + 6] = a;             // a
      v[vi + 7] = geo[gi + 6];  // u
      v[vi + 8] = geo[gi + 7];  // v (texture v)
      v[vi + 9 ] = geo[gi + 3]; // nx
      v[vi + 10] = geo[gi + 4]; // ny
      v[vi + 11] = geo[gi + 5]; // nz
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

    if (!this._buf) this._buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);

    const FSIZE  = v.BYTES_PER_ELEMENT;
    const STRIDE = 12 * FSIZE;
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_Color,    4, gl.FLOAT, false, STRIDE, 3 * FSIZE);
    gl.enableVertexAttribArray(a_Color);
    gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, STRIDE, 7 * FSIZE);
    gl.enableVertexAttribArray(a_UV);
    gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 9 * FSIZE);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, VERTS);
  }
}
