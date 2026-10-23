import * as THREE from 'three';
import { LEVELS, UPGRADES, FAKE_NAMES } from './data.js';
import { buildTrack, getGround, progressAlong } from './track.js';
import { Car } from './car.js';

const UP = new THREE.Vector3(0, 1, 0);
const SAVE = 'cozyDrift_v1';

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE)) || { completed: [], upgrades: [], name: '' }; }
  catch { return { completed: [], upgrades: [], name: '' }; }
}
function writeSave(s) { localStorage.setItem(SAVE, JSON.stringify(s)); }

function getLeaderboard(levelId) {
  const key = `cozyDrift_lb_${levelId}`;
  let lb = JSON.parse(localStorage.getItem(key) || 'null');
  if (!lb) {
    // seed with friendly fake scores scaled by level difficulty
    lb = FAKE_NAMES.slice(0, 5).map((n, i) => ({
      name: n,
      score: Math.floor((6000 - i * 900) * (1 + levelId * 0.4)),
      date: Date.now() - i * 86400000,
    }));
    localStorage.setItem(key, JSON.stringify(lb));
  }
  return lb;
}
function saveLeaderboard(levelId, lb) {
  lb.sort((a, b) => b.score - a.score);
  lb = lb.slice(0, 10);
  localStorage.setItem(`cozyDrift_lb_${levelId}`, JSON.stringify(lb));
}

export function startGame() {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);

  const hemi = new THREE.HemisphereLight(0xfff3e0, 0x6a8f5a, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.5);
  sun.position.set(50, 80, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  scene.add(sun);
  scene.add(sun.target);

  const car = new Car(scene);
  const raycaster = new THREE.Raycaster();

  const save = loadSave();
  const state = {
    screen: 'menu',
    currentLevel: null,
    track: null,
    progress: 0,
    flow: 1,
    points: 0,
    maxFlow: 1,
    time: 0,
    finished: false,
    particles: null,
    lastSafe: new THREE.Vector3(),
    lastSafeHeading: 0,
    lastSafeTimer: 0,
  };

  const input = { throttle: false, brake: false, left: false, right: false, drift: false };

  // ---------- INPUT ----------
  const keyMap = {
    KeyW: 'throttle', ArrowUp: 'throttle',
    KeyS: 'brake', ArrowDown: 'brake',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'drift',
  };
  window.addEventListener('keydown', e => {
    if (keyMap[e.code]) { input[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyR' && state.screen === 'playing') restartLevel();
  });
  window.addEventListener('keyup', e => {
    if (keyMap[e.code]) { input[keyMap[e.code]] = false; e.preventDefault(); }
  });

  // ---------- UI ----------
  const $ = id => document.getElementById(id);
  const showScreen = name => {
    state.screen = name;
    ['menu', 'levels', 'hud', 'results'].forEach(s => $(s).classList.toggle('active', s === name));
  };

  $('btn-play').onclick = () => { renderLevelSelect(); showScreen('levels'); };
  $('btn-back').onclick = () => showScreen('menu');
  $('btn-reset').onclick = () => {
    if (confirm('Erase all progress, upgrades, and scores?')) {
      localStorage.removeItem(SAVE);
      for (const l of LEVELS) localStorage.removeItem(`cozyDrift_lb_${l.id}`);
      location.reload();
    }
  };

  function renderLevelSelect() {
    const list = $('level-list');
    list.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const unlocked = i === 0 || save.completed.includes(i - 1);
      const lb = getLeaderboard(lvl.id);
      const best = lb[0]?.score || 0;
      const card = document.createElement('div');
      card.className = 'level-card' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <h3>${unlocked ? lvl.name : '🔒 ' + lvl.name}</h3>
        <p>${lvl.description}</p>
        <div class="best">Best: ${unlocked ? best.toLocaleString() : '—'}</div>
      `;
      if (unlocked) card.onclick = () => startLevel(lvl);
      list.appendChild(card);
    });
  }

  // ---------- LEVEL START ----------
  function startLevel(lvl) {
    // clear old
    while (scene.children.length > 0) scene.remove(scene.children[0]);
    scene.add(hemi, sun, sun.target);

    // theme
    const th = lvl.theme;
    scene.background = new THREE.Color(th.sky);
    scene.fog = new THREE.FogExp2(th.fog, th.fogDensity);
    sun.color.setHex(th.sun);
    sun.intensity = th.sunIntensity;
    hemi.color.setHex(th.sun);
    hemi.groundColor.setHex(th.ambient);

    // rebuild car (it was removed with scene children)
    car.mesh = car._buildMesh();
    car.wheels = car.mesh.children.filter(c => c.geometry?.type === 'CylinderGeometry');
    scene.add(car.mesh);

    // apply upgrades
    const mods = save.upgrades.map(id => UPGRADES.find(u => u.id === id)?.apply).filter(Boolean);
    car.applyStats(mods);

    // build track
    const track = buildTrack(scene, lvl);
    state.track = track;

    // spawn
    const p0 = track.curve.getPointAt(0);
    const t0 = track.curve.getTangentAt(0);
    const h0 = Math.atan2(-t0.x, -t0.z);
    car.resetAt(p0, h0);
    state.lastSafe.copy(car.position);
    state.lastSafeHeading = h0;

    state.currentLevel = lvl;
    state.flow = 1;
    state.points = 0;
    state.maxFlow = 1;
    state.time = 0;
    state.finished = false;
    state.progress = 0;
    state.lastSafeTimer = 0;

    // particles
    buildParticles(th);

    // camera
    const camFwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, h0);
    camera.position.copy(car.position).addScaledVector(camFwd, -12).add(new THREE.Vector3(0, 7, 0));
    camera.lookAt(car.position);

    showScreen('hud');
    updateHUD(true);
  }

  function restartLevel() {
    if (state.currentLevel) startLevel(state.currentLevel);
  }

  // ---------- PARTICLES ----------
  function buildParticles(theme) {
    if (state.particles) { scene.remove(state.particles); state.particles.geometry.dispose(); state.particles.material.dispose(); }
    const count = 300;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i*3+0] = (Math.random() - 0.5) * 80;
      pos[i*3+1] = Math.random() * 30;
      pos[i*3+2] = (Math.random() - 0.5) * 80;
      speed[i] = 2 + Math.random() * 4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const size = theme.particleType === 'rain' ? 0.15 : 0.35;
    const mat = new THREE.PointsMaterial({
      color: theme.particle,
      size,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData = { speed, type: theme.particleType };
    scene.add(pts);
    state.particles = pts;
  }

  function updateParticles(dt) {
    const p = state.particles;
    if (!p) return;
    const arr = p.geometry.attributes.position.array;
    const speeds = p.userData.speed;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i*3+1] -= speeds[i] * dt;
      if (p.userData.type === 'rain') arr[i*3+0] -= 0.5 * dt;
      if (p.userData.type === 'snow') arr[i*3+0] += Math.sin(performance.now() * 0.001 + i) * dt * 0.5;
      if (arr[i*3+1] < -5) {
        arr[i*3+1] = 30 + Math.random() * 10;
        arr[i*3+0] = car.position.x + (Math.random() - 0.5) * 80;
        arr[i*3+2] = car.position.z + (Math.random() - 0.5) * 80;
      }
    }
    p.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- GAME LOOP ----------
  const clock = new THREE.Clock();

  function updatePlaying(dt) {
    const track = state.track;
    if (!track) return;

    // ground
    const ground = getGround(raycaster, track.road, car.position);

    // grip multiplier from level theme
    const gripMult = state.currentLevel.gripMultiplier || 1;

    car.update(dt, input, ground, gripMult);

    state.time += dt;

    // progress
    const prog = progressAlong(track.curve, car.position);
    state.progress = prog;

    // flow logic
    const isDrifting = car.drifting && car.lateralSpeed > 3;
    const isOnBank = ground && (1 - Math.abs(ground.normal.y)) > 0.25;
    const isFast = car.speed > 15;

    if (isDrifting || isOnBank) {
      let gain = state.currentLevel.gripMultiplier; // so icy levels still give flow
      gain = 1;
      if (isFast) gain *= 2;
      if (car.stats.adrenaline && car.speed > car.stats.maxSpeed * 0.7) gain *= 1.5;
      state.flow += gain * car.stats.flowGain * dt;
    } else {
      state.flow -= 0.6 * dt;
    }
    state.flow = Math.max(1, Math.min(20, state.flow));
    state.maxFlow = Math.max(state.maxFlow, state.flow);

    // points
    if (isDrifting || isOnBank) {
      const driftContrib = Math.abs(car.lateralSpeed) * 0.5 + (isOnBank ? 1 : 0);
      state.points += driftContrib * car.speed * state.flow * dt * 0.8;
    }

    // safe respawn
    state.lastSafeTimer += dt;
    if (state.lastSafeTimer > 1.0 && ground && car.position.y > ground.point.y - 1) {
      state.lastSafe.copy(car.position);
      state.lastSafeHeading = car.heading;
      state.lastSafeTimer = 0;
    }

    // fell off
    const startPoint = track.curve.getPointAt(0);
    if (car.position.y < startPoint.y - 60) {
      // crash — reset to last safe spot, lose flow
      car.resetAt(state.lastSafe, state.lastSafeHeading);
      state.flow = Math.max(1, state.flow * (car.stats.flowRetain || 0));
    }

    // finish
    if (prog > 0.97 && !state.finished) {
      finishLevel();
    }

    // camera follow
    const camFwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, car.heading);
    const camPos = car.position.clone().addScaledVector(camFwd, -11).add(new THREE.Vector3(0, 6.5, 0));
    camera.position.lerp(camPos, 0.12);
    const look = car.position.clone().addScaledVector(camFwd, 6).add(new THREE.Vector3(0, 1, 0));
    camera.lookAt(look);
    sun.position.copy(car.position).add(new THREE.Vector3(50, 80, 50));
    sun.target.position.copy(car.position);

    updateParticles(dt);
    updateHUD(false);
  }

  function updateHUD(force) {
    $('hud-speed').innerHTML = Math.round(car.speed * 3.6) + '<span>km/h</span>';
    $('hud-flow').textContent = '×' + state.flow.toFixed(1);
    $('hud-points').textContent = Math.round(state.points).toLocaleString() + ' pts';
    $('hud-progress-fill').style.width = (state.progress * 100).toFixed(1) + '%';
  }

  // ---------- FINISH ----------
  function finishLevel() {
    state.finished = true;

    const speedBonus = Math.round(state.maxFlow * 200);
    const total = Math.round(state.points + speedBonus);

    // leaderboard
    const name = save.name || 'You';
    const lb = getLeaderboard(state.currentLevel.id);
    lb.push({ name, score: total, date: Date.now() });
    saveLeaderboard(state.currentLevel.id, lb);

    // mark completed
    if (!save.completed.includes(state.currentLevel.id)) {
      save.completed.push(state.currentLevel.id);
    }
    writeSave(save);

    // show results
    const nextLevel = LEVELS[state.currentLevel.id + 1];
    const stats = $('results-stats');
    stats.innerHTML = `
      <div class="stat"><div class="label">Score</div><div class="value">${total.toLocaleString()}</div></div>
      <div class="stat"><div class="label">Max Flow</div><div class="value">×${state.maxFlow.toFixed(1)}</div></div>
      <div class="stat"><div class="label">Time</div><div class="value">${state.time.toFixed(1)}s</div></div>
    `;

    // 3 random upgrade cards
    const cards = $('upgrade-cards');
    cards.innerHTML = '';
    const pool = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const upg of pool) {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <div class="icon">${upg.icon}</div>
        <div class="name">${upg.name}</div>
        <div class="desc">${upg.desc}</div>
      `;
      el.onclick = () => pickUpgrade(upg);
      cards.appendChild(el);
    }

    // leaderboard display
    const lbDiv = $('leaderboard');
    const top = lb.slice(0, 5);
    lbDiv.innerHTML = `<h4>Mountain Board</h4>` + top.map((row, i) =>
      `<div class="lb-row ${row.name === name && row.score === total ? 'you' : ''}">
        <span class="rank">${i + 1}.</span>
        <span class="name">${row.name}</span>
        <span>${row.score.toLocaleString()}</span>
      </div>`
    ).join('');

    showScreen('results');
  }

  function pickUpgrade(upg) {
    save.upgrades.push(upg.id);
    writeSave(save);
    renderLevelSelect();
    showScreen('levels');
  }

  // ---------- ANIMATE ----------
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    if (state.screen === 'playing') updatePlaying(dt);
    renderer.render(scene, camera);
  }
  animate();

  // ---------- RESIZE ----------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}