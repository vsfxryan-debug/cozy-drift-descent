import * as THREE from 'three';
import { LEVELS, UPGRADES, FAKE_NAMES } from './data.js';
import { buildTrack, progressAlong } from './track.js';
import { Vehicle } from './vehicle.js';

const UP = new THREE.Vector3(0, 1, 0);
const SAVE = 'cozyDrift_rapier_v1';

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE)) || { completed: [], upgrades: [], name: '' }; }
  catch { return { completed: [], upgrades: [], name: '' }; }
}
function writeSave(s) { localStorage.setItem(SAVE, JSON.stringify(s)); }

function getLeaderboard(levelId) {
  const key = `cozyDrift_lb_${levelId}`;
  let lb = JSON.parse(localStorage.getItem(key) || 'null');
  if (!lb) {
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

export function startGame(world, RAPIER) {
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

  const vehicle = new Vehicle(world, RAPIER, scene);

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
    lastSafe: new THREE.Vector3(0, 6, 0),
    lastSafeQuat: new THREE.Quaternion(),
    lastSafeTimer: 0,
  };

  const input = { throttle: false, brake: false, left: false, right: false, drift: false };

  const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  if (isTouch) {
    document.body.classList.add('touch-active');
    input.throttle = true;

    const bindHold = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = e => { e.preventDefault(); if (key) input[key] = true; el.classList.add('pressed'); };
      const up = e => { e.preventDefault(); if (key) input[key] = false; el.classList.remove('pressed'); };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      el.addEventListener('mouseleave', up);
      el.addEventListener('contextmenu', e => e.preventDefault());
    };

    bindHold('touch-left', 'left');
    bindHold('touch-right', 'right');
    bindHold('touch-brake', 'brake');
    bindHold('touch-drift', 'drift');

    const restartBtn = document.getElementById('touch-restart');
    if (restartBtn) {
      restartBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state.screen === 'playing' && state.currentLevel) startLevel(state.currentLevel);
      }, { passive: false });
    }

    const flipBtn = document.getElementById('touch-flip');
    if (flipBtn) {
      flipBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        flipBtn.classList.add('pressed');
        setTimeout(() => flipBtn.classList.remove('pressed'), 120);
        document.body.classList.toggle('brake-right');
      }, { passive: false });
    }
  }

  const keyMap = {
    KeyW: 'throttle', ArrowUp: 'throttle',
    KeyS: 'brake', ArrowDown: 'brake',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'drift',
  };
  window.addEventListener('keydown', e => {
    if (keyMap[e.code]) { input[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyR' && state.screen === 'playing' && state.currentLevel) startLevel(state.currentLevel);
  });
  window.addEventListener('keyup', e => {
    if (keyMap[e.code]) { input[keyMap[e.code]] = false; e.preventDefault(); }
  });

  const $ = id => document.getElementById(id);
  const showScreen = name => {
    state.screen = name;
    ['menu', 'levels', 'hud', 'results'].forEach(s => $(s).classList.toggle('active', s === name));
  };

  $('btn-play').onclick = () => { renderLevelSelect(); showScreen('levels'); };
  $('btn-back').onclick = () => showScreen('menu');
  $('btn-reset').onclick = () => {
    if (confirm('Erase all progress?')) {
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

  function startLevel(lvl) {
    while (scene.children.length > 0) scene.remove(scene.children[0]);
    scene.add(hemi, sun, sun.target);
    scene.add(vehicle.mesh);

    const th = lvl.theme;
    scene.background = new THREE.Color(th.sky);
    scene.fog = new THREE.FogExp2(th.fog, th.fogDensity);
    sun.color.setHex(th.sun);
    sun.intensity = th.sunIntensity;
    hemi.color.setHex(th.sun);
    hemi.groundColor.setHex(th.ambient);

    const mods = save.upgrades.map(id => UPGRADES.find(u => u.id === id)?.apply).filter(Boolean);
    vehicle.applyUpgrades(mods);

    const track = buildTrack(world, RAPIER, scene, lvl);
    state.track = track;

    const p0 = track.curve.getPointAt(0);
    const t0 = track.curve.getTangentAt(0);
    const h0 = Math.atan2(-t0.x, -t0.z);
    const quat = new THREE.Quaternion().setFromAxisAngle(UP, h0);
    // Spawn 2 units above the road so the wheels have room to reach the ground.
    vehicle.reset(
      { x: p0.x, y: p0.y + 2, z: p0.z },
      { x: quat.x, y: quat.y, z: quat.z, w: quat.w }
    );

    state.lastSafe.copy(p0);
    state.lastSafeQuat.copy(quat);

    state.currentLevel = lvl;
    state.flow = 1;
    state.points = 0;
    state.maxFlow = 1;
    state.time = 0;
    state.finished = false;
    state.progress = 0;
    state.lastSafeTimer = 0;

    const camFwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, h0);
    const carPos = vehicle.position;
    camera.position.copy(carPos).addScaledVector(camFwd, -11).add(new THREE.Vector3(0, 6.5, 0));
    camera.lookAt(carPos.clone().addScaledVector(camFwd, 6).add(new THREE.Vector3(0, 1, 0)));

    showScreen('hud');
    state.screen = 'playing';
    updateHUD();
  }

  function updateHUD() {
    $('hud-speed').innerHTML = Math.round(vehicle.speed * 3.6) + '<span>km/h</span>';
    $('hud-flow').textContent = '×' + state.flow.toFixed(1);
    $('hud-points').textContent = Math.round(state.points).toLocaleString() + ' pts';
    $('hud-progress-fill').style.width = (state.progress * 100).toFixed(1) + '%';
  }

  const clock = new THREE.Clock();

  function updatePlaying(dt) {
    const track = state.track;
    if (!track) return;

    // Rapier fixed-step-ish: cap dt to keep physics stable on frame drops.
    const physDt = Math.min(dt, 1 / 30);
    world.timestep = physDt;

    vehicle.setInput(input);
    vehicle.update(physDt);
    world.step();
    vehicle.syncMesh();

    state.time += dt;

    const pos = vehicle.position;
    const prog = progressAlong(track.curve, pos);
    state.progress = prog;

    const lateral = vehicle.lateralSpeed;
    const isDrifting = lateral > 3.5;
    const isFast = vehicle.speed > 10;

    if (isDrifting) {
      let gain = 1;
      if (isFast) gain *= 2;
      state.flow += gain * dt;
    } else {
      state.flow -= 0.6 * dt;
    }
    state.flow = Math.max(1, Math.min(20, state.flow));
    state.maxFlow = Math.max(state.maxFlow, state.flow);

    if (isDrifting) {
      state.points += lateral * vehicle.speed * state.flow * dt * 0.6;
    }

    state.lastSafeTimer += dt;
    const startY = track.curve.getPointAt(0).y;
    if (state.lastSafeTimer > 1.0 && pos.y > startY - 10) {
      state.lastSafe.copy(pos);
      const r = vehicle.chassis.rotation();
      state.lastSafeQuat.set(r.x, r.y, r.z, r.w);
      state.lastSafeTimer = 0;
    }

    if (pos.y < startY - 60) {
      vehicle.reset(
        { x: state.lastSafe.x, y: state.lastSafe.y + 2, z: state.lastSafe.z },
        { x: state.lastSafeQuat.x, y: state.lastSafeQuat.y, z: state.lastSafeQuat.z, w: state.lastSafeQuat.w }
      );
      state.flow = 1;
    }

    if (prog > 0.97 && !state.finished) finishLevel();

    const fwd = vehicle.forward;
    const camPos = pos.clone().addScaledVector(fwd, -11).add(new THREE.Vector3(0, 6.5, 0));
    camera.position.lerp(camPos, 0.12);
    const look = pos.clone().addScaledVector(fwd, 6).add(new THREE.Vector3(0, 1, 0));
    camera.lookAt(look);
    sun.position.copy(pos).add(new THREE.Vector3(50, 80, 50));
    sun.target.position.copy(pos);

    updateHUD();
  }

  function finishLevel() {
    state.finished = true;
    const speedBonus = Math.round(state.maxFlow * 200);
    const total = Math.round(state.points + speedBonus);
    const name = save.name || 'You';
    const lb = getLeaderboard(state.currentLevel.id);
    lb.push({ name, score: total, date: Date.now() });
    saveLeaderboard(state.currentLevel.id, lb);

    if (!save.completed.includes(state.currentLevel.id)) save.completed.push(state.currentLevel.id);
    writeSave(save);

    const stats = $('results-stats');
    stats.innerHTML = `
      <div class="stat"><div class="label">Score</div><div class="value">${total.toLocaleString()}</div></div>
      <div class="stat"><div class="label">Max Flow</div><div class="value">×${state.maxFlow.toFixed(1)}</div></div>
      <div class="stat"><div class="label">Time</div><div class="value">${state.time.toFixed(1)}s</div></div>
    `;

    const cards = $('upgrade-cards');
    cards.innerHTML = '';
    const pool = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const upg of pool) {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<div class="icon">${upg.icon}</div><div class="name">${upg.name}</div><div class="desc">${upg.desc}</div>`;
      el.onclick = () => pickUpgrade(upg);
      cards.appendChild(el);
    }

    const lbDiv = $('leaderboard');
    const top = lb.slice(0, 5);
    lbDiv.innerHTML = `<h4>Mountain Board</h4>` + top.map((row, i) =>
      `<div class="lb-row ${row.name === name && row.score === total ? 'you' : ''}">
        <span class="rank">${i + 1}.</span><span class="name">${row.name}</span><span>${row.score.toLocaleString()}</span>
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

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    try {
      if (state.screen === 'playing') updatePlaying(dt);
    } catch (err) {
      console.error('updatePlaying error:', err);
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}