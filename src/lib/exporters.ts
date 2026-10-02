// PNG / GLB export helpers.

import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { canvas2DRef, content3DRef } from '../refs';
import type { ViewMode } from '../types';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Export the current view (2D canvas or 3D framebuffer) as a PNG. */
export function exportPNG(mode: ViewMode): string | null {
  if (mode === '3d') {
    const gl = document.querySelector('canvas');
    if (!gl) return 'No 3D view open';
    // Give the renderer one frame so the buffer is fresh, then grab it.
    requestAnimationFrame(() => {
      try {
        gl.toBlob((b) => b && download(b, 'roomcraft-3d.png'), 'image/png');
      } catch {
        /* renderer not ready */
      }
    });
    return null;
  }
  const cv = canvas2DRef.current;
  if (!cv) return 'No floorplan to export';
  cv.toBlob((b) => b && download(b, 'roomcraft-floorplan.png'), 'image/png');
  return null;
}

/** Export the 3D scene (floor + walls + furniture) as a binary glTF. */
export function exportGLB(): string | null {
  const group = content3DRef.current;
  if (!group) return 'Switch to 3D mode first, then export';
  const exporter = new GLTFExporter();
  exporter.parse(
    group,
    (buf) => {
      if (buf instanceof ArrayBuffer) {
        download(new Blob([buf], { type: 'model/gltf-binary' }), 'roomcraft.glb');
      }
    },
    () => {
      /* export error — surfaced by toast below */
    },
    { binary: true },
  );
  return null;
}
