/* eslint-disable react/no-unknown-property */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const seededRandom = (seed) => {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const LearningStars = ({ accentColor, active }) => {
  const pointsRef = useRef(null);
  const positions = useMemo(() => {
    const random = seededRandom(2706);
    const values = new Float32Array(72 * 3);
    for (let index = 0; index < 72; index += 1) {
      values[index * 3] = (random() - 0.5) * 11;
      values[index * 3 + 1] = (random() - 0.5) * 5.2;
      values[index * 3 + 2] = -1.5 - random() * 3.5;
    }
    return values;
  }, []);

  useFrame((state, delta) => {
    if (!active || !pointsRef.current) return;
    pointsRef.current.rotation.z += delta * 0.018;
    pointsRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.12;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={accentColor} size={0.055} transparent opacity={0.75} depthWrite={false} sizeAttenuation blending={THREE.AdditiveBlending} />
    </points>
  );
};

const EnergyOrbit = ({ radius, accentColor, rotation, speed, active }) => {
  const orbitRef = useRef(null);

  useFrame((_, delta) => {
    if (!active || !orbitRef.current) return;
    orbitRef.current.rotation.z += delta * speed;
  });

  return (
    <group ref={orbitRef} rotation={rotation}>
      <mesh>
        <torusGeometry args={[radius, 0.018, 8, 96]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
    </group>
  );
};

const HolographicBook = ({ accentColor, active }) => {
  const bookRef = useRef(null);
  const leftPageRef = useRef(null);
  const rightPageRef = useRef(null);
  const orbitGroupRef = useRef(null);
  const { viewport } = useThree();
  const isCompact = viewport.width < 7;
  const accent = useMemo(() => new THREE.Color(accentColor), [accentColor]);
  const secondary = useMemo(() => new THREE.Color(accentColor).offsetHSL(0.13, 0.08, 0.08), [accentColor]);

  useFrame((state, delta) => {
    if (!active) return;
    const time = state.clock.elapsedTime;
    if (bookRef.current) {
      bookRef.current.position.y = Math.sin(time * 0.72) * 0.12;
      bookRef.current.rotation.x = -0.08 + Math.sin(time * 0.35) * 0.025;
      bookRef.current.rotation.z = Math.sin(time * 0.28) * 0.025;
    }
    if (leftPageRef.current) leftPageRef.current.rotation.y = -0.34 + Math.sin(time * 0.9) * 0.045;
    if (rightPageRef.current) rightPageRef.current.rotation.y = 0.34 - Math.sin(time * 0.9) * 0.045;
    if (orbitGroupRef.current) orbitGroupRef.current.rotation.y += delta * 0.08;
  });

  const pageOpacity = isCompact ? 0.24 : 0.58;
  const coverOpacity = isCompact ? 0.34 : 1;
  const pageMaterial = { color: '#f8fafc', transparent: true, opacity: pageOpacity, roughness: 0.2, metalness: 0.12 };

  return (
    <group position={[isCompact ? 0 : 2.35, isCompact ? -0.42 : 0, isCompact ? -0.85 : -0.1]} scale={isCompact ? 0.56 : 0.88}>
      <group ref={bookRef}>
        <mesh position={[0, 0, -0.45]}>
          <sphereGeometry args={[1.38, 28, 28]} />
          <meshBasicMaterial color={accent} transparent opacity={0.055} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        <group ref={leftPageRef} position={[-0.68, 0, 0]} rotation={[0, -0.34, -0.035]}>
          <mesh position={[0, 0, -0.08]}>
            <boxGeometry args={[1.45, 1.78, 0.075]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.22} roughness={0.34} metalness={0.25} transparent={isCompact} opacity={coverOpacity} />
          </mesh>
          {[0, 1, 2].map((layer) => (
            <mesh key={layer} position={[0.035 + layer * 0.012, 0.03, 0.015 + layer * 0.038]} scale={[0.95 - layer * 0.015, 0.94 - layer * 0.012, 1]}>
              <boxGeometry args={[1.42, 1.7, 0.026]} />
              <meshStandardMaterial {...pageMaterial} opacity={pageOpacity - layer * 0.04} />
            </mesh>
          ))}
        </group>

        <group ref={rightPageRef} position={[0.68, 0, 0]} rotation={[0, 0.34, 0.035]}>
          <mesh position={[0, 0, -0.08]}>
            <boxGeometry args={[1.45, 1.78, 0.075]} />
            <meshStandardMaterial color={secondary} emissive={secondary} emissiveIntensity={0.22} roughness={0.34} metalness={0.25} transparent={isCompact} opacity={coverOpacity} />
          </mesh>
          {[0, 1, 2].map((layer) => (
            <mesh key={layer} position={[-0.035 - layer * 0.012, 0.03, 0.015 + layer * 0.038]} scale={[0.95 - layer * 0.015, 0.94 - layer * 0.012, 1]}>
              <boxGeometry args={[1.42, 1.7, 0.026]} />
              <meshStandardMaterial {...pageMaterial} opacity={pageOpacity - layer * 0.04} />
            </mesh>
          ))}
        </group>

        <mesh position={[0, -0.02, 0.12]}>
          <capsuleGeometry args={[0.045, 1.58, 8, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.72} />
        </mesh>
      </group>

      <group ref={orbitGroupRef}>
        <EnergyOrbit radius={2.05} accentColor={accentColor} rotation={[1.25, 0.15, 0.2]} speed={0.09} active={active} />
        <EnergyOrbit radius={2.45} accentColor={secondary} rotation={[0.65, 0.8, -0.4]} speed={-0.055} active={active} />
      </group>
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
      <div className="absolute inset-0 opacity-35" style={{ background: `radial-gradient(circle at 76% 44%, ${accentColor}55, transparent 42%), linear-gradient(120deg, transparent 38%, ${accentColor}18 100%)` }} />
      <Canvas
        camera={{ position: [0, 0, 7.2], fov: 44 }}
        dpr={[1, 1.5]}
        frameloop={active ? 'always' : 'demand'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[-3, 4, 5]} intensity={0.9} color="#ffffff" />
        <pointLight position={[3, 2, 4]} intensity={1.7} color={accentColor} />
        <LearningStars accentColor={accentColor} active={active} />
        <HolographicBook accentColor={accentColor} active={active} />
      </Canvas>
    </div>
  );
};

export default SantriLevelScene;
