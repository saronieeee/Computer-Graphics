// Static geometry shared by every Cube instance — built once at load time, never modified.
// Layout: 12 triangles × 3 vertices × 3 xyz-coords = 108 floats
const _CUBE_VPOS = new Float32Array([
  // Front (z=+0.5) — tri 0 & 1
  -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5,
  -0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  // Top (y=+0.5) — tri 2 & 3
  -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
  -0.5, 0.5,-0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  // Right (x=+0.5) — tri 4 & 5
   0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,
   0.5,-0.5, 0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
  // Left (x=-0.5) — tri 6 & 7
  -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5,
  -0.5,-0.5,-0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5,
  // Bottom (y=-0.5) — tri 8 & 9
  -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5,-0.5,-0.5,
  -0.5,-0.5, 0.5,  0.5,-0.5,-0.5, -0.5,-0.5,-0.5,
  // Back (z=-0.5) — tri 10 & 11
   0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,
   0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,
]);

// Per-face brightness (two triangles per face share the same value)
const _CUBE_BRIGHT = [
  1.0, 1.0,    // Front
  0.95, 0.95,  // Top
  0.80, 0.80,  // Right
  0.70, 0.70,  // Left
  0.50, 0.50,  // Bottom
  0.60, 0.60,  // Back
];

// UV pattern for any two-triangle quad face: BL BR TR | BL TR TL
const _FACE_UV = [0,0, 1,0, 1,1, 0,0, 1,1, 0,1];

// Per-face v-range within the TEXTURE0 grass atlas.
// Face order mirrors _CUBE_VPOS: Front, Top, Right, Left, Bottom, Back.
// Atlas layout (with UNPACK_FLIP_Y=1):
//   v=0.75..1.00 → grass top (data rows 0-7)
//   v=0.25..0.75 → grass side: green strip at top, brown below (data rows 8-23)
//   v=0.00..0.25 → pure dirt (data rows 24-31)
const _GRASS_FACE_V = [
  [0.25, 0.75],  // Front  – grass side
  [0.75, 1.00],  // Top    – grass top (bright green)
  [0.25, 0.75],  // Right  – grass side
  [0.25, 0.75],  // Left   – grass side
  [0.00, 0.25],  // Bottom – dirt
  [0.25, 0.75],  // Back   – grass side
];

class Cube {
  constructor() {
    this.type       = 'cube';
    this.color      = [1.0, 1.0, 1.0, 1.0];
    this.textureNum = -2;
    this.matrix     = new Matrix4();

    // Pre-allocated once; reused every render() call — no per-frame GC
    this.verts32 = new Float32Array(36 * 9);  // 36 verts × [xyz rgba uv]

    // GL buffer created once per Cube instance, reused every render
    this._buf = null;
  }

  render() {
    const [r, g, b, a] = this.color;
    const v = this.verts32;

    // Fill [x,y,z, r,g,b,a, u,v] — positions and UVs read from statics;
    // only the brightness-scaled color changes per call.
    // In texture mode the fragment colour comes from the sampler, so encode only
    // the per-face brightness as a grey scale in v_Color.  In colour mode, bake
    // the actual block colour × brightness as usual.
    const useTexture = this.textureNum >= 0;
    let idx = 0;
    for (let tri = 0; tri < 12; tri++) {
      const br = _CUBE_BRIGHT[tri];
      const fr = useTexture ? br : r * br;
      const fg = useTexture ? br : g * br;
      const fb = useTexture ? br : b * br;
      const posBase = tri * 9;   // 3 verts × 3 coords per triangle
      for (let vi = 0; vi < 3; vi++) {
        // position
        v[idx++] = _CUBE_VPOS[posBase + vi*3];
        v[idx++] = _CUBE_VPOS[posBase + vi*3 + 1];
        v[idx++] = _CUBE_VPOS[posBase + vi*3 + 2];
        // color
        v[idx++] = fr; v[idx++] = fg; v[idx++] = fb; v[idx++] = a;
        // UV — tri%2 picks which triangle half, vi picks vertex within it
        const uvSlot = (tri % 2) * 3 + vi;
        const uu = _FACE_UV[uvSlot * 2];
        let   vv = _FACE_UV[uvSlot * 2 + 1];
        // Remap v into the correct atlas region for the grass block
        if (this.textureNum === 0) {
          const fi = tri >> 1;   // face index 0-5
          const [vlo, vhi] = _GRASS_FACE_V[fi];
          vv = vlo + vv * (vhi - vlo);
        }
        v[idx++] = uu;
        v[idx++] = vv;
      }
    }

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    gl.uniform1i(u_whichTexture, this.textureNum);

    // Create buffer only on first render; subsequent calls reuse it
    if (!this._buf) this._buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);

    const FSIZE  = v.BYTES_PER_ELEMENT;
    const STRIDE = 9 * FSIZE;  // 36 bytes
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_Color,    4, gl.FLOAT, false, STRIDE, 3 * FSIZE);
    gl.enableVertexAttribArray(a_Color);
    gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, STRIDE, 7 * FSIZE);
    gl.enableVertexAttribArray(a_UV);

    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
}
