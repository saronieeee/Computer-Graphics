/**
 * Represents a drawable point shape.
 */
class Point {
  /**
   * Creates a point with default type, position, color, and size.
   */
  constructor() {
    this.type = 'point';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.size = 5.0;
  }

  /**
   * Renders this point to the current WebGL canvas.
   */
  render() {
    const xy = this.position;
    const rgba = this.color;
    const size = this.size;

    // Points use their center directly; WebGL handles the square point sprite size.

    gl.disableVertexAttribArray(a_Position);
    gl.vertexAttrib3f(a_Position, xy[0], xy[1], 0.0);
    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
    gl.uniform1f(u_Size, size);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}
