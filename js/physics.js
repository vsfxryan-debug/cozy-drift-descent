import RAPIER from '@dimforge/rapier3d-compat';

export async function initPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  return { world, RAPIER };
}