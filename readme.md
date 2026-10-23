# Cozy Drift Descent (Rapier)

A browser-based drift game built on **Three.js** for rendering and **Rapier** for vehicle physics.
The car is a single rigid body with four ray-cast wheels. Drift is achieved by lowering rear-wheel
friction while the handbrake is held.

## Run locally

Because this uses ES modules and an import map, serve it over HTTP:

```bash
python3 -m http.server 8000
# open http://localhost:8000