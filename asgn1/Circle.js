/**
 * Represents a drawable circle approximated by a set of triangles.
 */
class Circle {
  /**
   * Creates a circle with default type, position, color, size, and segment count.
   */
  constructor() {
    this.type = 'circle';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.size = 5.0;
    this.segments = 10;
  }

  /**
   * Renders this circle by drawing a fan of triangles around its center.
   */
  render() {
    const xy = this.position;
    const rgba = this.color;
    const size = this.size;
    // Convert the UI size into the circle radius in clip-space coordinates.
    const d = size / 200.0;

    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
    gl.uniform1f(u_Size, size);

    const angleStep = 360 / this.segments;
    for (let angle = 0; angle < 360; angle += angleStep) {
      const angle1 = angle * Math.PI / 180;
      const angle2 = (angle + angleStep) * Math.PI / 180;

      // Compute two neighboring points on the circle edge, then fill that slice as a triangle.
      const pt1 = [xy[0] + Math.cos(angle1) * d, xy[1] + Math.sin(angle1) * d];
      const pt2 = [xy[0] + Math.cos(angle2) * d, xy[1] + Math.sin(angle2) * d];

      drawTriangle([xy[0], xy[1], pt1[0], pt1[1], pt2[0], pt2[1]]);
    }
  }
}
