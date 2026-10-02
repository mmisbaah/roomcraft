// 3D room view: floor, walls (with windows & doors), furniture, orbit camera.

import { Suspense, useEffect, useMemo } from 'react';
import { Fog, Shape, Vector3 } from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { EdgeKind, Vec2 } from '../types';
import { polyCentroid } from '../logic/geometry';
import { objectHotkey } from '../logic/hotkeys';
import { useStore } from '../store';
import { content3DRef, camera3DRef } from '../refs';
import { Furniture, CEIL_H } from './Furniture';

const WALL_H = CEIL_H;
const WALL_T = 0.12;

function WallSegment({
  a,
  b,
  kind,
}: {
  a: Vec2;
  b: Vec2;
  kind: EdgeKind;
}) {
  // 2D (x, y) maps to 3D (x, 0, -y) so the top-down 2D view matches.
  const ax = a.x;
  const az = -a.y;
  const bx = b.x;
  const bz = -b.y;
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const rotY = Math.atan2(-dz, dx);

  return (
    <group position={[(ax + bx) / 2, 0, (az + bz) / 2]} rotation={[0, rotY, 0]}>
      {kind === 'wall' && (
        <mesh position={[0, WALL_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[len, WALL_H, WALL_T]} />
          <meshStandardMaterial color="#f3efe8" roughness={0.92} />
        </mesh>
      )}
      {kind === 'window' && (
        <>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[len, 0.9, WALL_T]} />
            <meshStandardMaterial color="#f3efe8" roughness={0.92} />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[len, 1.2, 0.03]} />
            <meshStandardMaterial color="#a7d4f0" transparent opacity={0.32} roughness={0.1} metalness={0.1} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[len, 0.6, WALL_T]} />
            <meshStandardMaterial color="#f3efe8" roughness={0.92} />
          </mesh>
          {/* sill */}
          <mesh position={[0, 0.93, 0]} receiveShadow>
            <boxGeometry args={[len, 0.06, WALL_T + 0.08]} />
            <meshStandardMaterial color="#e6e0d6" roughness={0.85} />
          </mesh>
        </>
      )}
      {kind === 'door' && (
        <>
          <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[len, 0.6, WALL_T]} />
            <meshStandardMaterial color="#f3efe8" roughness={0.92} />
          </mesh>
          {/* jambs */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * len) / 2 - s * 0.03, WALL_H / 2 - 0.3, 0]} castShadow>
              <boxGeometry args={[0.06, WALL_H - 0.6, WALL_T + 0.02]} />
              <meshStandardMaterial color="#d9d2c5" roughness={0.85} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function Floor({ room }: { room: Vec2[] }) {
  const shape = useMemo(() => {
    const s = new Shape();
    room.forEach((p, i) => {
      if (i === 0) s.moveTo(p.x, p.y);
      else s.lineTo(p.x, p.y);
    });
    s.closePath();
    return s;
  }, [room]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#e9e2d5" roughness={0.95} />
    </mesh>
  );
}

export default function Scene3D() {
  const room = useStore((s) => s.room);
  const openings = useStore((s) => s.openings);
  const items = useStore((s) => s.items);
  const walls = useStore((s) => s.walls);
  const select = useStore((s) => s.select);
  const tryMove = useStore((s) => s.tryMove);
  const tryMoveRaw = useStore((s) => s.tryMoveRaw);

  // Keyboard: arrows/WASD nudge the selection, R rotates, Del removes —
  // the same shortcuts as the 2D view (which unmounts while 3D is shown).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        const st = useStore.getState();
        if (st.selected) st.select(null);
        return;
      }

      // In 3D mode, compute camera-relative directions for arrows/WASD
      if (camera3DRef.current) {
        const cam = camera3DRef.current;
        // Camera basis vectors in world space (columns of matrixWorld)
        const m = cam.matrixWorld.elements;
        const right = new Vector3(m[0], m[1], m[2]).normalize(); // screen right
        const fwd = new Vector3(-m[8], -m[9], -m[10]).normalize(); // screen forward (away from cam)

        // Project to ground plane (XZ)
        right.y = 0; right.normalize();
        fwd.y = 0; fwd.normalize();

        // Map world XZ to 2D store coords: 2D (x, y) <-> 3D (x, -z)
        const worldTo2D = (wx: number, wz: number) => ({ dx: wx, dy: -wz });

        // Screen up = move object AWAY from camera on ground = forward direction
        // Screen right = move object to screen right = right direction
        const handled = objectHotkey(e, {
          ArrowUp: () => worldTo2D(fwd.x, fwd.z),
          ArrowDown: () => worldTo2D(-fwd.x, -fwd.z),
          ArrowLeft: () => worldTo2D(-right.x, -right.z),
          ArrowRight: () => worldTo2D(right.x, right.z),
          KeyW: () => worldTo2D(fwd.x, fwd.z),
          KeyS: () => worldTo2D(-fwd.x, -fwd.z),
          KeyA: () => worldTo2D(-right.x, -right.z),
          KeyD: () => worldTo2D(right.x, right.z),
        });
        if (handled) return;
      }

      objectHotkey(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!room) return null;
  const c = polyCentroid(room);
  const target: [number, number, number] = [c.x, 0, -c.y];

  return (
    <Canvas
      shadows
      className="scene3d"
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: [c.x + 6.5, 7, -c.y + 8.5], fov: 42, near: 0.1, far: 500 }}
      onCreated={({ gl, scene, camera }) => {
        gl.setClearColor('#e9edf4');
        // Ground fades into the sky so the plane's edge is never visible.
        scene.fog = new Fog('#e9edf4', 55, 190);
        // Debug/verification hook: allows a manual render when rAF is throttled.
        (window as any).__rcDebug = { gl, scene, camera };
        // Store camera ref for camera-relative movement
        camera3DRef.current = camera;
      }}
    >
      <hemisphereLight args={['#ffffff', '#b9c2d0', 0.75]} />
      <directionalLight
        position={[9, 14, 6]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-7, 8, -9]} intensity={0.45} />

      <group ref={content3DRef}>
        <Floor room={room} />
        {room.map((a, i) => (
          <WallSegment key={i} a={a} b={room[(i + 1) % room.length]} kind={openings[i] ?? 'wall'} />
        ))}
        {/* free-built partitions (🧱 tool) */}
        {walls.map((w) => (
          <WallSegment key={w.id} a={w.a} b={w.b} kind={w.kind} />
        ))}
        <Suspense fallback={null}>
          {items.map((p) => (
            <Furniture key={p.uid} p={p} onSelect={select} onMove={tryMoveRaw} />
          ))}
        </Suspense>
      </group>

      {/* ground plane — extends past the fog so there is never a visible edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c.x, -0.03, -c.y]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#c9d6b4" roughness={1} />
      </mesh>

      <OrbitControls
        makeDefault
        target={target}
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={40}
        maxPolarAngle={Math.PI * 0.47}
      />
    </Canvas>
  );
}
