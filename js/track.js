import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const SEGMENTS = 220;

export function buildTrack(scene, level) {
  const pts = level.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const W = level.width;
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
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const bank = bankAt(t);

    let right = new THREE.Vector3().crossVectors(tangent, UP).normalize();
    if (Math.abs(bank) > 1e-4) right.applyAxisAngle(tangent, bank);

    const leftPt = point.clone().addScaledVector(right, -W / 2);
    const rightPt = point.clone().addScaledVector(right, W / 2);
    const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();

    positions.push(leftPt.x, leftPt.y, leftPt.z);
    positions.push(rightPt.x, rightPt.y, rightPt.z);
    normals.push(normal.x, normal.y, normal.z);
    normals.push(normal.x, normal.y, normal.z);
    uvs.push(0, t * 20);
    uvs.push(1, t * 20);
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const roadMat = new THREE.MeshStandardMaterial({
    color: level.theme.ground,
    roughness: 0.9,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const road = new THREE.Mesh(geo, roadMat);
  road.receiveShadow = true;
  scene.add(road);

  // ---- Curb strips ----
  for (const side of [-1, 1]) {
    const curbPositions = [];
    const curbIndices = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const bank = bankAt(t);
      let right = new THREE.Vector3().crossVectors(tangent, UP).normalize();
      if (Math.abs(bank) > 1e-4) right.applyAxisAngle(tangent, bank);
      const inner = point.clone().addScaledVector(right, side * W / 2);
      const outer = point.clone().addScaledVector(right, side * (W / 2 + 1.2));
      curbPositions.push(inner.x, inner.y + 0.05, inner.z);
      curbPositions.push(outer.x, outer.y + 0.15, outer.z);
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (side === 1) curbIndices.push(a, c, b, b, c, d);
      else curbIndices.push(a, b, c, b, d, c);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
    cg.setIndex(curbIndices);
    cg.computeVertexNormals();
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xfff3d0, roughness: 0.7 });
    scene.add(new THREE.Mesh(cg, curbMat));
  }

  // ---- Scenery (instanced trees + rocks) ----
  const treeCount = level.sceneryDensity;
  const treeGeo = new THREE.ConeGeometry(1.6, 5, 6);
  const treeMat = new THREE.MeshStandardMaterial({ color: level.theme.tree, roughness: 1.0, flatShading: true });
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, treeCount);

  const rockCount = Math.floor(level.sceneryDensity * 0.5);
  const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: level.theme.rock, roughness: 1.0, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);

  const dummy = new THREE.Object3D();

  const placeAlong = (count, mesh, isTree) => {
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tangent, UP).normalize();
      const side = Math.random() < 0.5 ? -1 : 1;
      const offset = side * (W / 2 + 2 + Math.random() * 18);
      const pos = point.clone().addScaledVector(right, offset);
      pos.y += isTree ? 2.5 : 0.5;
      dummy.position.copy(pos);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      const s = isTree ? 0.7 + Math.random() * 0.9 : 0.5 + Math.random() * 1.2;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  };

  placeAlong(treeCount, trees, true);
  placeAlong(rockCount, rocks, false);

  return { curve, road, bankAt };
}

export function getGround(raycaster, road, position) {
  raycaster.set(new THREE.Vector3(position.x, position.y + 6, position.z), new THREE.Vector3(0, -1, 0));
  const hits = raycaster.intersectObject(road, false);
  if (!hits.length) return null;
  const h = hits[0];
  const normal = h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0);
  return { point: h.point.clone(), normal };
}

export function progressAlong(curve, position) {
  let minD = Infinity, bestT = 0;
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const p = curve.getPointAt(t);
    const d = p.distanceToSquared(position);
    if (d < minD) { minD = d; bestT = t; }
  }
  // refine
  let lo = Math.max(0, bestT - 1 / 60), hi = Math.min(1, bestT + 1 / 60);
  for (let i = 0; i < 20; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    const d1 = curve.getPointAt(m1).distanceToSquared(position);
    const d2 = curve.getPointAt(m2).distanceToSquared(position);
    if (d1 < d2) hi = m2; else lo = m1;
  }
  return (lo + hi) / 2;
}