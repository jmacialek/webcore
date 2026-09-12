---
status: accepted
date: 2026-09-12
---
# One Three.js scene serves both Camera Modes

Classic and Tower View are two cameras on the same 3D scene graph, rendered
with the WebGL2 renderer behind a seam that allows WebGPU later. We rejected a
separate 2D canvas renderer for Classic, which would have been lighter and
closer to the 2007 look, because two renderers double the presentation test
surface and because the icon system requires each Tower's HUD icon and on-map
mesh to be the same shape. Classic therefore has subtle depth (bevelled
Platforms, glowing Channel edges, projectiles with height) rather than being
strictly flat.
