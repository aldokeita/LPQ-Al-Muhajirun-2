/* eslint-disable react/no-unknown-property */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import './ModelViewer.css';

const degToRad = (degree) => (degree * Math.PI) / 180;

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setReduced(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return reduced;
};

const usePageVisible = () => {
  const [visible, setVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return visible;
};

const ModelScene = ({
  url,
  scale = 1.65,
  rotation = [-16, -26, 0],
  position = [0, -0.1, 0],
  autoRotate = true,
  autoRotateSpeed = 0.34,
  enabled = true,
  onModelLoaded,
}) => {
  const groupRef = useRef(null);
  const normalizedRef = useRef(false);
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || normalizedRef.current) return;

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const largestSide = Math.max(size.x, size.y, size.z) || 1;

    model.position.set(-center.x, -center.y, -center.z);
    model.scale.setScalar(scale / largestSide);
    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = false;
        if (object.material) {
          object.material.envMapIntensity = 0.9;
          object.material.needsUpdate = true;
        }
      }
    });

    const [rotationX, rotationY, rotationZ] = rotation.map(degToRad);
    group.rotation.set(rotationX, rotationY, rotationZ);
    group.position.set(...position);
    normalizedRef.current = true;
    onModelLoaded?.();
  }, [model, onModelLoaded, position, rotation, scale]);

  useFrame((_, delta) => {
    if (!enabled || !autoRotate || !groupRef.current) return;
    groupRef.current.rotation.y += autoRotateSpeed * delta;
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
};

const ModelViewer = ({
  url,
  width = 300,
  height = 300,
  className = '',
  environmentPreset = 'studio',
  defaultZoom = 2.75,
  modelScale = 1.65,
  modelPosition = [0, -0.08, 0],
  modelRotation = [-16, -26, 0],
  autoRotate = true,
  autoRotateSpeed = 0.34,
  fadeIn = true,
  onModelLoaded,
}) => {
  const reducedMotion = useReducedMotion();
  const pageVisible = usePageVisible();
  const shouldAnimate = pageVisible && !reducedMotion;

  useEffect(() => {
    if (url) useGLTF.preload(url);
  }, [url]);

  if (!url) return null;

  return (
    <div
      className={`rb-model-viewer ${fadeIn ? 'rb-model-viewer--fade' : ''} ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    >
      <Canvas
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 34, position: [0, 0, defaultZoom], near: 0.01, far: 100 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3.5, 4, 4.5]} intensity={1.35} />
        <directionalLight position={[-3, 2, 2]} intensity={0.55} />
        {environmentPreset !== 'none' && <Environment preset={environmentPreset} background={false} />}
        <Suspense fallback={null}>
          <ModelScene
            url={url}
            scale={modelScale}
            rotation={modelRotation}
            position={modelPosition}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            enabled={shouldAnimate}
            onModelLoaded={onModelLoaded}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ModelViewer;
