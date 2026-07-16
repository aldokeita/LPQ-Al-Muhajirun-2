/* eslint-disable react/no-unknown-property */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SHAPE_POSITIONS = [
  [-3.2, 1.2, -1.5], [-2.2, -1.4, 0.2], [-1.1, 1.8, -0.8],
  [0.4, -1.6, -1.4], [1.5, 1.45, 0], [2.7, -0.7, -0.5], [3.35, 1.7, -1.7],
];

const FloatingShapes = ({ accentColor, active }) => {
  const groupRef = useRef(null);
  const color = useMemo(() => new THREE.Color(accentColor), [accentColor]);

  useFrame((state, delta) => {
    if (!active || !groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.08;
    groupRef.current.children.forEach((child, index) => {
      child.position.y = SHAPE_POSITIONS[index][1] + Math.sin(state.clock.elapsedTime * 0.55 + index) * 0.16;
      child.rotation.x += delta * (0.08 + index * 0.008);
      child.rotation.z += delta * (index % 2 === 0 ? 0.1 : -0.08);
    });
  });

  return (
    <group ref={groupRef}>
      {SHAPE_POSITIONS.map((position, index) => (
        <mesh key={position.join('-')} position={position} scale={index % 3 === 0 ? 0.55 : 0.38}>
          {index % 3 === 0 ? <icosahedronGeometry args={[1, 0]} /> : index % 3 === 1 ? <octahedronGeometry args={[1, 0]} /> : <torusGeometry args={[0.7, 0.2, 10, 20]} />}
          <meshStandardMaterial color={color} transparent opacity={0.28} roughness={0.25} metalness={0.25} />
        </mesh>
      ))}
    </group>
  );
};

const useMotionState = () => {
  const [state, setState] = useState({ reduced: false, visible: true });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setState({ reduced: media.matches, visible: !document.hidden });
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return state;
};

const SantriLevelScene = ({ accentColor = '#0ea5e9' }) => {
  const { reduced, visible } = useMotionState();
  const active = visible && !reduced;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 75% 35%, ${accentColor}55, transparent 48%)` }} />
      <Canvas
        camera={{ position: [0, 0, 7], fov: 46 }}
        dpr={[1, 1.5]}
        frameloop={active ? 'always' : 'demand'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.8} />
        <pointLight position={[3, 4, 5]} intensity={1.2} color={accentColor} />
        <FloatingShapes accentColor={accentColor} active={active} />
      </Canvas>
    </div>
  );
};

export default SantriLevelScene;
