// Module-level refs shared between the 2D canvas, 3D scene and exporters.

import { createRef } from 'react';
import type { Group, Camera } from 'three';

/** The <canvas> used in 2D mode (PNG export). */
export const canvas2DRef = createRef<HTMLCanvasElement>();

/** The 3D content group (GLB export) — floor, walls and furniture. */
export const content3DRef = createRef<Group>();

/** The 3D camera (set in Scene3D's onCreated) for camera-relative movement. */
export const camera3DRef = createRef<Camera>();
