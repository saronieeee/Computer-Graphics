class Camera {
  constructor() {
    this.fov = 60;
    this.eye = new Vector3([0, 1.5, 3]);
    this.at  = new Vector3([0, 1.5, 2]);
    this.up  = new Vector3([0, 1,   0]);
    this.viewMatrix       = new Matrix4();
    this.projectionMatrix = new Matrix4();
  }

  updateViewMatrix() {
    const e = this.eye.elements, a = this.at.elements, u = this.up.elements;
    this.viewMatrix.setLookAt(e[0],e[1],e[2], a[0],a[1],a[2], u[0],u[1],u[2]);
  }

  updateProjectionMatrix() {
    this.projectionMatrix.setPerspective(this.fov, canvas.width / canvas.height, 0.1, 1000);
  }

  // Normalized forward vector projected onto XZ plane (FPS-style movement)
  _fwdXZ() {
    const f = new Vector3([
      this.at.elements[0] - this.eye.elements[0],
      0,
      this.at.elements[2] - this.eye.elements[2]
    ]);
    return f.normalize();
  }

  // Right vector (perpendicular to forward and up)
  _right() {
    const f = new Vector3([
      this.at.elements[0] - this.eye.elements[0],
      this.at.elements[1] - this.eye.elements[1],
      this.at.elements[2] - this.eye.elements[2]
    ]).normalize();
    return Vector3.cross(f, this.up).normalize();
  }

  forward(speed = 0.2) {
    const step = this._fwdXZ();
    step.mul(speed);
    this.eye.add(step);
    this.at.add(step);
  }

  back(speed = 0.2) {
    const step = this._fwdXZ();
    step.mul(speed);
    this.eye.sub(step);
    this.at.sub(step);
  }

  left(speed = 0.2) {
    const step = this._right();
    step.mul(speed);
    this.eye.sub(step);
    this.at.sub(step);
  }

  right(speed = 0.2) {
    const step = this._right();
    step.mul(speed);
    this.eye.add(step);
    this.at.add(step);
  }

  // Rotate the look direction around the Y axis by `deg` degrees
  panLeft(deg) {
    const f = new Vector3([
      this.at.elements[0] - this.eye.elements[0],
      this.at.elements[1] - this.eye.elements[1],
      this.at.elements[2] - this.eye.elements[2]
    ]);
    const rot = new Matrix4();
    rot.setRotate(deg, 0, 1, 0);
    const fp = rot.multiplyVector3(f);
    this.at.set(this.eye);
    this.at.add(fp);
  }

  panRight(deg) {
    this.panLeft(-deg);
  }

  // Rotate the look direction around the camera's right axis (pitch).
  // Clamped so the view can never flip past straight up or down.
  panUp(deg) {
    const f = new Vector3([
      this.at.elements[0] - this.eye.elements[0],
      this.at.elements[1] - this.eye.elements[1],
      this.at.elements[2] - this.eye.elements[2]
    ]);
    const right = this._right();
    const rot = new Matrix4();
    rot.setRotate(deg, right.elements[0], right.elements[1], right.elements[2]);
    const fp = rot.multiplyVector3(f);
    // Reject the rotation if it would point too close to straight up or down
    const fpn = new Vector3([fp.elements[0], fp.elements[1], fp.elements[2]]).normalize();
    if (Math.abs(Vector3.dot(fpn, this.up)) > 0.98) return;
    this.at.set(this.eye);
    this.at.add(fp);
  }

  panDown(deg) {
    this.panUp(-deg);
  }
}
