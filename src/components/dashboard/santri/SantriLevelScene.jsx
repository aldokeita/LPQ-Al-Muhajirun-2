/* eslint-disable react/no-unknown-property */
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Float, Sparkles, useAnimations, useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const MODEL_URL = '/models/RobotExpressive.glb';

const getLevelAnimation = (points) => {
  const score = Number(points) || 0;
  if (score >= 81) return 'Dance';
  if (score >= 51) return 'Wave';
  if (score >= 21) return 'Walking';
  return 'Idle';
};

const AnimatedLearningCompanion = ({ active, points }) => {
  const groupRef = useRef(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { viewport } = useThree();
  const compact = viewport.width < 7;
  const model = useMemo(() => {
    const cloned = clone(scene);
    cloned.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = !compact;
      node.receiveShadow = !compact;
      node.material = node.material.clone();
    });
    return cloned;
  }, [scene, compact]);
  const { actions } = useAnimations(animations, groupRef);
  const selectedAnimation = getLevelAnimation(points);

  useEffect(() => {
    const opacity = compact ? 0.28 : 0.94;
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.material.transparent = opacity < 1;
      node.material.opacity = opacity;
      node.material.depthWrite = !compact;
      node.material.needsUpdate = true;
    });
  }, [compact, model]);

  useEffect(() => {
    const action = actions?.[selectedAnimation] || actions?.Idle || Object.values(actions || {})[0];
    if (!action) return undefined;
    action.reset().fadeIn(0.35).play();
    action.paused = !active;
    return () => action.fadeOut(0.2);
  }, [actions, active, selectedAnimation]);

  useEffect(() => {
    Object.values(actions || {}).forEach((action) => {
      action.paused = !active;
    });
  }, [actions, active]);

  useFrame((state) => {
    if (!active || !groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.34) * 0.12;
  });

  return (
    <group
      ref={groupRef}
      position={[compact ? 0.9 : 2.45, compact ? -1.85 : -1.65, compact ? -1 : 0]}
      rotation={[0, compact ? -0.18 : -0.28, 0]}
      scale={compact ? 0.74 : 0.92}
    >
      <Float speed={active ? 1.15 : 0} rotationIntensity={active ? 0.08 : 0} floatIntensity={active ? 0.16 : 0}>
        <primitive object={model} />
      </Float>
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

const SantriLevelScene = ({ accentColor = '#0ea5e9', points = 0 }) => {
  const { reduced, visible } = useMotionState();
  const active = visible && !reduced;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 opacity-35" style={{ background: `radial-gradient(circle at 78% 44%, ${accentColor}55, transparent 38%), linear-gradient(120deg, transparent 38%, ${accentColor}18 100%)` }} />
      <Canvas
        camera={{ position: [0, 0.2, 7.4], fov: 42 }}
        dpr={[1, 1.5]}
        frameloop={active ? 'always' : 'demand'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        shadows={!reduced}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[-3, 5, 5]} intensity={1.35} color="#ffffff" />
        <pointLight position={[3, 2, 4]} intensity={2.1} color={accentColor} />
        <Sparkles count={reduced ? 0 : 34} scale={[8, 3.8, 3]} size={1.5} speed={active ? 0.25 : 0} color={accentColor} opacity={0.45} />
        <Suspense fallback={null}>
          <AnimatedLearningCompanion active={active} points={points} />
          <ContactShadows position={[2.45, -1.72, 0]} opacity={0.22} scale={3.5} blur={2.8} far={3.5} color={accentColor} />
        </Suspense>
      </Canvas>
    </div>
  );
};

useGLTF.preload(MODEL_URL);

export default SantriLevelScene;
