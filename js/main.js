import { initPhysics } from './physics.js';
import { startGame } from './game.js';

window.addEventListener('DOMContentLoaded', async () => {
  const { world, RAPIER } = await initPhysics();
  startGame(world, RAPIER);
});