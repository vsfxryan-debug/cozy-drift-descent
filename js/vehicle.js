import * as THREE from 'three';

export class Vehicle {
  constructor(world, RAPIER, scene) {
    console.log('[CozyDrift] vehicle.js v6 loaded');

    this.world = world;
    this.RAPIER = RAPIER;
    this.scene = scene;

    this.base = {
      engineForce: 3500,
      brakeForce: 60,
      steerMax: 0.5,
      frictionSlip: 3.5,
      driftFrictionSlip: 0.9,
      suspensionStiffness: 60,
      suspensionCompression: 4.0,
      suspensionRelaxation: 4.0,
      suspensionRestLength: 0.3,
      suspensionMaxTravel: 0.2,
      wheelRadius: 0.42,
    };
    this.stats = { ...this.base };

    this.input = { throttle: false, brake: false, left: false, right: false, drift: false };
    this._steer = 0;
    this._hh = 0.35;

    this._build();
  }

  setInput(input) {
    this.input = input;
  }

  _build() {
    const { RAPIER, world } = this;

    const chassisDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 6, 0)
      .setLinearDamping(0.15)
      .setAngularDamping(0.4);
    this.chassis = world.createRigidBody(chassisDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.9, this._hh, 1.9)
      .setDensity(120)
      .setFriction(0.2);
    this.chassisCollider = world.createCollider(colliderDesc, this.chassis);

    this.controller = world.createVehicleController(this.chassis);

    const hw = 0.85;
    this.wheelLocalPositions = [
      { x: -hw, y: -this._hh, z: -1.3 }, // 0 front left
      { x:  hw, y: -this._hh, z: -1.3 }, // 1 front right
      { x: -hw, y: -this._hh, z:  1.3 }, // 2 rear left
      { x:  hw, y: -this._hh, z:  1.3 }, // 3 rear right
    ];

    // Rapier's wheel forward = down × axle.
    //   down × (1,0,0)  = (0,0,+1) → positive engine = +Z = backward.
    //   down × (-1,0,0) = (0,0,-1) → positive engine = -Z = forward. ✓
    const down = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };

    for (const pos of this.wheelLocalPositions) {
      this.controller.addWheel(
        pos, down, axle,
        this.stats.suspensionRestLength,
        this.stats.wheelRadius
      );
    }

    this._applyTuning();
    this._buildMesh();
  }

  _applyTuning() {
    const c = this.controller;
    for (let i = 0; i < c.numWheels(); i++) {
      c.setWheelSuspensionStiffness(i, this.stats.suspensionStiffness);
      c.setWheelSuspensionCompression(i, this.stats.suspensionCompression);
      c.setWheelSuspensionRelaxation(i, this.stats.suspensionRelaxation);
      c.setWheelMaxSuspensionTravel(i, this.stats.suspensionMaxTravel);
      c.setWheelFrictionSlip(i, this.stats.frictionSlip);
      c.setWheelSteering(i, 0);
      c.setWheelEngineForce(i, 0);
      c.setWheelBrake(i, 0);
    }
  }

  _buildMesh() {
    const g = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.5, 3.6),
      new THREE.MeshStandardMaterial({ color: 0xd97757, roughness: 0.55, metalness: 0.15 })
    );
    body.position.y = 0.1;
    body.castShadow = true;
    g.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.55, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xffe4c4, roughness: 0.7 })
    );
    cabin.position.set(0, 0.6, 0);
    g.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(this.stats.wheelRadius, this.stats.wheelRadius, 0.28, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

    this.wheels = [];
    for (let i = 0; i < this.wheelLocalPositions.length; i++) {
      const p = this.wheelLocalPositions[i];
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      // Fixed offset — no suspension tracking, so no jitter/wobble.
      w.position.set(p.x, p.y - this.stats.suspensionRestLength, p.z);
      w.rotation.order = 'YXZ';
      g.add(w);
      this.wheels.push(w);
    }

    this.mesh = g;
    this.scene.add(g);
  }

  applyUpgrades(mods) {
    this.stats = { ...this.base };
    for (const fn of mods) fn(this.stats);
    this._applyTuning();
  }

  update(dt) {
    const c = this.controller;
    const inp = this.input;

    const steerTarget = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
    this._steer = THREE.MathUtils.lerp(this._steer, steerTarget, 0.2);
    const steer = this._steer * this.stats.steerMax;

    c.setWheelSteering(0, steer);
    c.setWheelSteering(1, steer);

    // Positive engine now drives forward (-Z) thanks to axle = (-1,0,0).
    const engine = inp.throttle ? this.stats.engineForce : 0;
    c.setWheelEngineForce(2, engine);
    c.setWheelEngineForce(3, engine);

    const brake = inp.brake ? this.stats.brakeForce : 0;
    for (let i = 0; i < 4; i++) c.setWheelBrake(i, brake);

    const rearFriction = inp.drift ? this.stats.driftFrictionSlip : this.stats.frictionSlip;
    c.setWheelFrictionSlip(2, rearFriction);
    c.setWheelFrictionSlip(3, rearFriction);
    c.setWheelFrictionSlip(0, this.stats.frictionSlip);
    c.setWheelFrictionSlip(1, this.stats.frictionSlip);

    c.updateVehicle(dt);
  }

  syncMesh() {
    const t = this.chassis.translation();
    const r = this.chassis.rotation();
    this.mesh.position.set(t.x, t.y, t.z);
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w);

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const steering = this.controller.wheelSteering(i) || 0;
      const rotation = this.controller.wheelRotation(i) || 0;
      w.rotation.y = steering;
      w.rotation.x = rotation % (Math.PI * 2);
    }
  }

  get position() {
    const t = this.chassis.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get speed() {
    const v = this.chassis.linvel();
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  get forward() {
    const r = this.chassis.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  }

  get lateralSpeed() {
    const v = this.chassis.linvel();
    const fwd = this.forward;
    const dot = v.x * fwd.x + v.y * fwd.y + v.z * fwd.z;
    const vx = v.x - fwd.x * dot;
    const vy = v.y - fwd.y * dot;
    const vz = v.z - fwd.z * dot;
    return Math.sqrt(vx * vx + vy * vy + vz * vz);
  }

  reset(pos, quat) {
    this.chassis.setTranslation(pos, true);
    this.chassis.setRotation(quat, true);
    this.chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.syncMesh();
  }
}