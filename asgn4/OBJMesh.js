// Generic OBJ loader — parses v / vt / vn / f / usemtl lines.
// Uses the same 12-float interleaved layout as Cube/Sphere/Cylinder:
//   xyz(3) + rgba(4) + uv(2) + nxyz(3)
// Material colours are looked up from a per-instance map so the sword parts
// get distinct colours without needing texture images.

class OBJMesh {
  constructor() {
    this.type       = 'objmesh';
    this.color      = [1.0, 1.0, 1.0, 1.0]; // fallback when no material match
    this.textureNum = -2;
    this.matrix     = new Matrix4();

    // Material → base RGBA lookup (populated by caller or left empty)
    this.materialColors = {};

    this._buf      = null;
    this._verts    = null;   // Float32Array, built by load()
    this._numVerts = 0;
    this._bufDirty = false;  // true once _verts is ready; cleared after first upload
    this._ready    = false;
  }

  // Async — call from main() or equivalent.  render() silently does nothing until ready.
  async load(url) {
    let text;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(resp.status);
      text = await resp.text();
    } catch (err) {
      console.error('OBJMesh: failed to load', url, err);
      return;
    }

    const vPos  = [];  // flat: x0,y0,z0, x1,y1,z1, ...
    const vUV   = [];  // flat: u0,v0, u1,v1, ...
    const vNorm = [];  // flat: nx0,ny0,nz0, ...
    const flat  = [];  // output interleaved floats

    let cr = this.color[0], cg = this.color[1],
        cb = this.color[2], ca = this.color[3];

    for (const rawLine of text.split('\n')) {
      const line  = rawLine.trim();
      const parts = line.split(/\s+/);
      switch (parts[0]) {
        case 'v':
          vPos.push(+parts[1], +parts[2], +parts[3]);
          break;
        case 'vt':
          vUV.push(+parts[1], +parts[2]);
          break;
        case 'vn':
          vNorm.push(+parts[1], +parts[2], +parts[3]);
          break;
        case 'usemtl': {
          const mc = this.materialColors[parts[1]];
          if (mc) { cr=mc[0]; cg=mc[1]; cb=mc[2]; ca=mc[3]; }
          else    { cr=this.color[0]; cg=this.color[1]; cb=this.color[2]; ca=this.color[3]; }
          break;
        }
        case 'f': {
          // Fan-triangulate (handles tris and quads)
          const poly = [];
          for (let i = 1; i < parts.length; i++) {
            const tok = parts[i].split('/');
            poly.push({
              vi: (parseInt(tok[0]) - 1) * 3,
              ti: tok[1] ? (parseInt(tok[1]) - 1) * 2 : -1,
              ni: tok[2] ? (parseInt(tok[2]) - 1) * 3 : -1,
            });
          }
          for (let i = 1; i < poly.length - 1; i++) {
            for (const w of [poly[0], poly[i], poly[i + 1]]) {
              flat.push(
                vPos[w.vi], vPos[w.vi+1], vPos[w.vi+2],
                cr, cg, cb, ca,
                w.ti >= 0 ? vUV[w.ti]     : 0,
                w.ti >= 0 ? vUV[w.ti + 1] : 0,
                w.ni >= 0 ? vNorm[w.ni]     : 0,
                w.ni >= 0 ? vNorm[w.ni + 1] : 0,
                w.ni >= 0 ? vNorm[w.ni + 2] : 1,
              );
            }
          }
          break;
        }
      }
    }

    this._verts    = new Float32Array(flat);
    this._numVerts = flat.length / 12;
    this._bufDirty = true;
    this._ready    = true;
    console.log(`OBJMesh loaded: ${url} — ${this._numVerts} vertices`);
  }

  render() {
    if (!this._ready) return;

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
    if (this._bufDirty) {
      gl.bufferData(gl.ARRAY_BUFFER, this._verts, gl.STATIC_DRAW);
      this._bufDirty = false;
    }

    const FSIZE  = Float32Array.BYTES_PER_ELEMENT;
    const STRIDE = 12 * FSIZE;
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_Color,    4, gl.FLOAT, false, STRIDE, 3 * FSIZE);
    gl.enableVertexAttribArray(a_Color);
    gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, STRIDE, 7 * FSIZE);
    gl.enableVertexAttribArray(a_UV);
    gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 9 * FSIZE);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, this._numVerts);
  }
}
