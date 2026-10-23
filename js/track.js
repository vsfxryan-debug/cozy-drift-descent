import * as THREE from 'three';

export function buildTrack(world, RAPIER, scene, level) {
  const pts = level.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const W = level.width;
  const SEGMENTS = 240;
  const bankArr = level.banks;
  const bankCount = bankArr.length;

  const bankAt = (t) => {
    const idx = t * (bankCount - 1);
    const i = Math.floor(idx);
    const f = idx - i;
    const a = bankArr[i];
    const b = bankArr[Math.min(i + 1, bankCount - 1)];
    return a * (1 - f) + b * f;
  };

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const bank = bankAt(t);

    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    if (Math.abs(bank) > 1e-4) right.applyAxisAngle(tangent, bank);

    const leftPt = point.clone().addScaledVector(right, -W / 2);
    const rightPt = point.clone().addScaledVector(right, W / 2);

    positions.push(leftPt.x, leftPt.y, leftPt.z);
    positions.push(rightPt.x, rightPt.y, rightPt.z);
    uvs.push(0, t * 20);
    uvs.push(1, t * 20);
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    color: level.theme.ground,
    roughness: 0.9,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const roadMesh = new THREE.Mesh(geometry, roadMat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // Rapier trimesh collider
  const vertices = new Float32Array(positions);
  const indicesArray = new Uint32Array(indices);
  const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indicesArray);
  const bodyDesc = RAPIER.RigidBodyDesc.fixed();
  const body = world.createRigidBody(bodyDesc);
  world.createCollider(colliderDesc, body);

  // Scenery (visual only, no colliders)
  const dummy = new THREE.Object3D();
  const treeGeo = new THREE.ConeGeometry(1.6, 5, 6);
  const treeMat = new THREE.MeshStandardMaterial({ color: level.theme.tree, roughness: 1, flatShading: true });
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, level.sceneryDensity);

  for (let i = 0; i < level.sceneryDensity; i++) {
    const t = Math.random();
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const side = Math.random() < 0.5 ? -1 : 1;
    const offset = side * (W / 2 + 2 + Math.random() * 18);
    const pos = point.clone().addScaledVector(right, offset);
    pos.y += 2.5;
    dummy.position.copy(pos);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    const s = 0.7 + Math.random() * 0.9;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trees.setMatrixAt(i, dummy.matrix);
  }
  trees.instanceMatrix.needsUpdate = true;
  scene.add(trees);

  return { curve, roadMesh };
}

export function progressAlong(curve, position) {
  let minD = Infinity, bestT = 0;
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const p = curve.getPointAt(t);
    const d = p.distanceToSquared(position);
    if (d < minD) { minD = d; bestT = t; }
  }
  let lo = Math.max(0, bestT - 1 / 60), hi = Math.min(1, bestT + 1 / 60);
  for (let i = 0; i < 20; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    const d1 = curve.getPointAt(m1).distanceToSquared(position);
    const d2 = curve.getPointAt(m2).distanceToSquared(position);
    if (d1 < d2) hi = m2; else lo = m1;
  }
  return (lo + hi) / 2;
}