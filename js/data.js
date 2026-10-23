export const UPGRADES = [
  { id: 'turbo',  name: 'Turbo Spool',  icon: '⚡', desc: '+15% engine force',   apply: s => { s.engineForce *= 1.15; } },
  { id: 'sticky', name: 'Sticky Tires', icon: '🛞', desc: '+15% tyre grip',      apply: s => { s.frictionSlip *= 1.15; } },
  { id: 'drift',  name: 'Drift Master', icon: '💨', desc: '+25% drift grip',     apply: s => { s.driftFrictionSlip *= 1.25; } },
  { id: 'steer',  name: 'Quick Steering', icon: '🎯', desc: '+15% steering angle', apply: s => { s.steerMax *= 1.15; } },
  { id: 'susp',   name: 'Soft Suspension', icon: '☁️', desc: '+20% suspension stiffness', apply: s => { s.suspensionStiffness *= 1.2; } },
  { id: 'brake',  name: 'Better Brakes', icon: '🛑', desc: '+30% brake force',    apply: s => { s.brakeForce *= 1.3; } },
];

export const LEVELS = [
  {
    id: 0, name: 'Alpine Dawn',
    description: 'Misty pines and gentle curves. Learn to flow.',
    width: 14, gripMultiplier: 1.0,
    theme: { sky: 0xffe0b2, fog: 0xffd5a8, fogDensity: 0.018, sun: 0xfff0d0, sunIntensity: 1.6, ambient: 0xa0a080, ground: 0x6b8e4a, tree: 0x2d5a2d, rock: 0x6b5a4a },
    points: [[0,0,0],[0,-4,-40],[8,-8,-80],[18,-14,-120],[18,-22,-160],[8,-30,-200],[-8,-38,-240],[-18,-46,-280],[-18,-54,-320],[-8,-62,-360],[0,-70,-400]],
    banks: [0,0.2,0.5,0.4,0,-0.5,-0.6,-0.4,0,0.4,0.2],
    sceneryDensity: 40,
  },
  {
    id: 1, name: 'Mossy Canyon',
    description: 'Chained surf ramps down canyon walls.',
    width: 12, gripMultiplier: 1.0,
    theme: { sky: 0xd4a373, fog: 0xc19a6b, fogDensity: 0.025, sun: 0xffd5a0, sunIntensity: 1.2, ambient: 0x7a6a50, ground: 0x8b6a4a, tree: 0x4a6a2a, rock: 0x8a7a6a },
    points: [[0,0,0],[-5,-5,-30],[10,-10,-60],[20,-16,-90],[15,-24,-120],[0,-30,-150],[-15,-36,-180],[-25,-44,-210],[-20,-52,-240],[-5,-60,-270],[15,-68,-300],[20,-76,-330],[10,-84,-360]],
    banks: [0,0.4,-0.7,-0.9,-0.6,0.6,0.9,0.8,0.5,-0.7,-0.9,-0.5,0],
    sceneryDensity: 50,
  },
  {
    id: 2, name: 'Neon Rain',
    description: 'Wet asphalt, neon glow, low grip.',
    width: 13, gripMultiplier: 0.7,
    theme: { sky: 0x1a1030, fog: 0x2a1040, fogDensity: 0.022, sun: 0xaa88ff, sunIntensity: 1.0, ambient: 0x302060, ground: 0x2a2030, tree: 0x2a3a5a, rock: 0x3a3a4a },
    points: [[0,0,0],[0,-5,-30],[15,-10,-60],[20,-18,-90],[10,-26,-120],[-10,-34,-150],[-20,-42,-180],[-10,-50,-210],[10,-58,-240],[20,-66,-270],[10,-74,-300],[-10,-82,-330],[-10,-90,-360]],
    banks: [0,0,-0.7,-1.0,-0.6,0.7,1.0,0.5,-0.7,-0.9,-0.4,0.5,0],
    sceneryDensity: 40,
  },
  {
    id: 3, name: 'Cherry Blossom Pass',
    description: 'A rhythmic slalom of drift and surf.',
    width: 11, gripMultiplier: 1.0,
    theme: { sky: 0xffd0e0, fog: 0xffd5e5, fogDensity: 0.02, sun: 0xffe0e0, sunIntensity: 1.5, ambient: 0xd0a0b0, ground: 0x7a5a5a, tree: 0xffb0c0, rock: 0x8a6a6a },
    points: [[0,0,0],[5,-4,-25],[-5,-9,-50],[10,-15,-75],[-10,-22,-100],[15,-29,-125],[-15,-36,-150],[10,-43,-175],[-10,-50,-200],[15,-57,-225],[-15,-64,-250],[10,-71,-275],[-10,-78,-300],[5,-85,-325],[0,-92,-350]],
    banks: [0,-0.6,0.6,-0.7,0.7,-0.8,0.8,-0.7,0.7,-0.8,0.8,-0.6,0.6,-0.4,0],
    sceneryDensity: 55,
  },
  {
    id: 4, name: 'Frozen Peak',
    description: 'Ice, steep banks, and a final descent. The exam.',
    width: 12, gripMultiplier: 0.55,
    theme: { sky: 0xc0e0ff, fog: 0xd0e8ff, fogDensity: 0.015, sun: 0xffffff, sunIntensity: 1.0, ambient: 0x8090b0, ground: 0xe0f0ff, tree: 0x4a6a5a, rock: 0xa0b0c0 },
    points: [[0,0,0],[0,-6,-30],[-10,-12,-60],[10,-20,-90],[20,-28,-120],[10,-38,-150],[-10,-48,-180],[-20,-58,-210],[-10,-68,-240],[10,-78,-270],[20,-88,-300],[10,-98,-330],[-10,-108,-360],[-20,-118,-390],[-10,-128,-420]],
    banks: [0,0,0.7,-0.7,-1.0,-1.0,0.7,1.0,1.0,0.7,-0.8,-1.0,0.6,0.8,0.4],
    sceneryDensity: 60,
  },
];

export const FAKE_NAMES = ['CozyCarl', 'DriftDaisy', 'SurfSam', 'FlowFelix', 'MountainMia', 'PowderPete'];