import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export class Car {
  constructor(scene) {
    this.stats = {
      accel: 22,
      maxSpeed: 42,
      brake: 35,
      steerRate: 2.6,
      grip: 10,
      driftGrip: 2,
      flowGain: 1.0,
      flowRetain: 0,
      surfBonus: 1.0,
      adrenaline: false,
    };
    this.position = new THREE.Vector3(0, 1.2, 0);
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.quaternion = new THREE.Quaternion();
    this.speed = 0;
    this.lateralSpeed = 0;
    this.drifting = false;
    this.wheels = [];
    this.mesh = this._buildMesh();
    scene.add(this.mesh);
  }

  _buildMesh() {
    const g = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.55, 3.8),
      new THREE.MeshStandardMaterial({ color: 0xd97757, roughness: 0.55, metalness: 0.15 })
    );
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.65, 1.9),
      new THREE.MeshStandardMaterial({ color: 0xffe4c4, roughness: 0.7 })
    );
    cabin.position.set(0, 1.1, -0.1);
    g.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const wp = [[-0.95, 0.36, 1.2], [0.95, 0.36, 1.2], [-0.95, 0.36, -1.2], [0.95, 0.36, -1.2]];
    for (const [x, y, z] of wp) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, y, z);
      w.rotation.z = Math.PI / 2;
      g.add(w);
      this.wheels.push(w);
    }

    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffcc88, emissiveIntensity: 0.8 });
    for (const x of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.08), headlightMat);
      hl.position.set(x, 0.65, -1.95);
      g.add(hl);
    }
    return g;
  }

  applyStats(statModifiers) {
    // reset to base
    this.stats = {
      accel: 22, maxSpeed: 42, brake: 35, steerRate: 2.6,
      grip: 10, driftGrip: 2, flowGain: 1.0, flowRetain: 0,
      surfBonus: 1.0, adrenaline: false,
    };
    for (const fn of statModifiers) fn(this.stats);
  }

  resetAt(point, heading) {
    this.position.copy(point).add(new THREE.Vector3(0, 1.2, 0));
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.quaternion.setFromAxisAngle(UP, heading);
    this.speed = 0;
    this.lateralSpeed = 0;
  }

  update(dt, input, ground, gripMultiplier = 1) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);

    const fwdSpeed = this.velocity.dot(forward);

    // --- Steering ---
    if (Math.abs(fwdSpeed) > 0.8) {
      const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const speedFactor = Math.min(1, Math.abs(fwdSpeed) / 12);
      this.heading += steerInput * this.stats.steerRate * dt * speedFactor;
      this.quaternion.setFromAxisAngle(UP, this.heading);
    }

    // Recompute after steering
    forward.set(0, 0, -1).applyQuaternion(this.quaternion);
    right.set(1, 0, 0).applyQuaternion(this.quaternion);

    // --- Throttle / Brake ---
    if (input.throttle) {
      this.velocity.addScaledVector(forward, this.stats.accel * dt);
    }
    if (input.brake) {
      const vLen = this.velocity.length();
      if (vLen > 0.1) {
        const f = Math.max(0, 1 - (this.stats.brake * dt) / vLen);
        this.velocity.multiplyScalar(f);
      }
    }

    // --- Gravity ---
    this.velocity.y -= 9.8 * dt;

    // --- Lateral grip (drift physics) ---
    const fwdComp = forward.clone().multiplyScalar(this.velocity.dot(forward));
    const latComp = this.velocity.clone().sub(fwdComp);
    this.lateralSpeed = latComp.length();

    let gripRate = (input.drift ? this.stats.driftGrip : this.stats.grip) * gripMultiplier;
    // Surf reduction: steep surfaces = less lateral grip
    if (ground) {
      const tilt = 1 - Math.abs(ground.normal.y);
      gripRate *= Math.max(0.15, 1 - tilt * 0.85);
    }
    latComp.multiplyScalar(Math.exp(-gripRate * dt));
    this.velocity.copy(fwdComp).add(latComp);

    // --- Speed limit ---
    const maxV = this.stats.maxSpeed * (this.stats.surfBonus || 1);
    const vLen = this.velocity.length();
    if (vLen > maxV) this.velocity.multiplyScalar(maxV / vLen);

    // --- Position ---
    this.position.addScaledVector(this.velocity, dt);

    // --- Ground contact ---
    if (ground) {
      const targetY = ground.point.y + 0.5;
      if (this.position.y < targetY) {
        this.position.y = targetY;
        const n = ground.normal;
        const vn = this.velocity.dot(n);
        if (vn < 0) this.velocity.addScaledVector(n, -vn);
      }
    } else {
      // Off-road / in air — gentle drag so it doesn't feel hopeless
      this.velocity.multiplyScalar(1 - 0.4 * dt);
    }

    // --- Apply transforms ---
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.copy(this.quaternion);

    // tilt visual on banks
    if (ground) {
      const targetUp = ground.normal;
      const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion);
      const tiltQ = new THREE.Quaternion().setFromUnitVectors(currentUp, targetUp);
      const blended = this.quaternion.clone().premultiply(tiltQ);
      this.mesh.quaternion.slerp(blended, 0.2);
    }

    // wheel spin
    this.speed = this.velocity.length();
    const wheelSpin = this.speed * dt * 2;
    for (const w of this.wheels) w.rotation.x += wheelSpin;

    this.drifting = input.drift || this.lateralSpeed > 4;
  }
}