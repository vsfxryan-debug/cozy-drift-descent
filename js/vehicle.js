let accumulator = 0;
const FIXED_STEP = 1 / 60;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, clock.getDelta());
  accumulator += dt;

  try {
    if (state.screen === 'playing') {
      while (accumulator >= FIXED_STEP) {
        updatePlaying(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }
    } else {
      accumulator = 0;
    }
  } catch (err) {
    console.error('updatePlaying error:', err);
  }

  renderer.render(scene, camera);
}