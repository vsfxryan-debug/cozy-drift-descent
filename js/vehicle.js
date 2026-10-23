import * as THREE from 'three';

export class Vehicle {
  constructor(world, RAPIER, scene) {
    this.world = world;
    this.RAPIER = RAPIER;
    this.scene = scene;

    // Base stats — every tuning number lives here
    this.base = {
      engineForce: 3200,
      brakeForce: 60,
      steerMax: 0.55,
      frictionSlip: 3.0,
      driftFrictionSlip: 0.85,
      suspensionStiffness: 32,
      suspensionRestLength: 0.65,
      suspensionMaxTravel: 0.5,
      wheelRadius: 0.42,
    };
    this.stats = { ...this.base };

    this.input = { throttle: false, brake: false, left: false, right: false, drift: false };
    this._steer = 0;

    this._build();
  }

  // ←── THIS was missing. game.js calls it every frame.
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

    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.9, 0.35, 1.9)
      .setDensity(120)
      .setFriction(0.2);
    this.chassisCollider = world.createCollider(colliderDesc, this.chassis);

    this.controller = world.createVehicleController(this.chassis);

    const hw = 0.85;
    const hh = 0.35;
    const wheelPositions = [
      { x: -hw, y: -hh, z: -1.3 },
      { x:  hw, y: -hh, z: -1.3 },
      { x: -hw, y: -hh, z:  1.3 },
      { x:  hw, y: -hh, z:  1.3 },
    ];

    const down = { x: 0, y: -1, z: 0 };
    const axle = { x: 0, y: 0, z: 1 };

    for (const pos of wheelPositions) {
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
      c.setWheelSuspensionCompression(i, 8.0);
      c.setWheelSuspensionRelaxation(i, 8.0);
      c.setWheelSuspensionMaxTravel(i, this.stats.suspensionMaxTravel);
      c.setWheelFrictionSlip(i, this.stats.frictionSlip);
      c.setWheelSteering(i, 0);
      c.setWheelEngineForce(i, 0);
      c.setWheelBrake(i, 0);
    }
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

    const wheelGeo = new THREE.CylinderGeometry(this.stats.wheelRadius, this.stats.wheelRadius, 0.28, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    this.wheels = [];
    const wp = [[-0.95, 0.36, -1.2], [0.95, 0.36, -1.2], [-0.95, 0.36, 1.2], [0.95, 0.36, 1.2]];
    for (const [x, y, z] of wp) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, y, z);
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
    this._steer = THREE.MathUtils.lerp(this._steer, steerTarget, 0.15);
    const steer = this._steer * this.stats.steerMax;

    c.setWheelSteering(0, steer);
    c.setWheelSteering(1, steer);

    // Rear-wheel drive. Negative Z = forward for the chassis orientation.
    const engine = inp.throttle ? -this.stats.engineForce : 0;
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
      w.rotation.x = rotation;
      w.rotation.y = steering;
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
    // Immediately place the mesh so the camera doesn't see a stale frame.
    this.syncMesh();
  }
}