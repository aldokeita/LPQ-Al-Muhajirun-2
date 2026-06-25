import React, { useEffect, useRef, useState } from 'react';
import './LightPillar.css';

const qualityMap = {
  low: 0.72,
  medium: 0.9,
  high: 1.05,
};

const LightPillar = ({
  topColor = '#9dc1c7',
  bottomColor = '#00eb9d',
  intensity = 1,
  rotationSpeed = 0.4,
  glowAmount = 0.005,
  pillarWidth = 3,
  pillarHeight = 0.3,
  noiseIntensity = 0.3,
  pillarRotation = 53,
  interactive = true,
  mixBlendMode = 'color-dodge',
  quality = 'high',
}) => {
  const mountRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setFallback(true);
      return undefined;
    }

    let renderer;
    let scene;
    let camera;
    let mesh;
    let material;
    let geometry;
    let frameId = 0;
    let resizeObserver;
    let visible = true;
    let disposed = false;

    const init = async () => {
      try {
        const THREE = await import('three');
        if (disposed || !mount.isConnected) return;

        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: quality !== 'low', powerPreference: 'high-performance' });
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.className = 'rb-light-pillar__canvas';
        renderer.domElement.style.mixBlendMode = mixBlendMode;
        mount.appendChild(renderer.domElement);

        geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
        material = new THREE.ShaderMaterial({
          transparent: true,
          depthTest: false,
          depthWrite: false,
          uniforms: {
            uTime: { value: 0 },
            uTop: { value: new THREE.Color(topColor) },
            uBottom: { value: new THREE.Color(bottomColor) },
            uIntensity: { value: intensity },
            uGlow: { value: glowAmount },
            uWidth: { value: pillarWidth },
            uHeight: { value: pillarHeight },
            uNoise: { value: noiseIntensity },
            uRotation: { value: (pillarRotation * Math.PI) / 180 },
            uPointer: { value: new THREE.Vector2(0, 0) },
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = vec4(position.xy, 0.0, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            uniform vec3 uTop;
            uniform vec3 uBottom;
            uniform float uIntensity;
            uniform float uGlow;
            uniform float uWidth;
            uniform float uHeight;
            uniform float uNoise;
            uniform float uRotation;
            uniform vec2 uPointer;

            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              float a = hash(i);
              float b = hash(i + vec2(1.0, 0.0));
              float c = hash(i + vec2(0.0, 1.0));
              float d = hash(i + vec2(1.0, 1.0));
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            void main() {
              vec2 p = vUv - 0.5;
              float s = sin(uRotation);
              float c = cos(uRotation);
              p = mat2(c, -s, s, c) * p;
              p += uPointer * 0.045;

              float pillar = exp(-pow(abs(p.x) * uWidth, 1.74)) * smoothstep(0.62, -0.22, abs(p.y) * uHeight);
              float core = exp(-pow(abs(p.x) * uWidth * 3.4, 1.25)) * smoothstep(0.52, -0.25, abs(p.y));
              float shimmer = noise(vec2(p.x * 12.0 + uTime * 0.45, p.y * 9.0 - uTime * 0.22));
              float rays = pow(max(0.0, 1.0 - abs(p.x * 2.2 + sin(p.y * 6.0 + uTime) * 0.08)), 3.2);
              float alpha = clamp((pillar + core * 0.8 + rays * 0.24 + shimmer * uNoise * 0.12) * uIntensity, 0.0, 1.0);
              vec3 color = mix(uBottom, uTop, smoothstep(-0.4, 0.58, vUv.y));
              color += vec3(uGlow * 80.0, uGlow * 140.0, uGlow * 120.0);
              gl_FragColor = vec4(color, alpha * 0.82);
            }
          `,
        });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const resize = () => {
          if (!renderer || !mount) return;
          const rect = mount.getBoundingClientRect();
          const ratio = qualityMap[quality] || qualityMap.medium;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8) * ratio);
          renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
        };

        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();

        const render = (time = 0) => {
          if (disposed) return;
          if (visible && !document.hidden) {
            material.uniforms.uTime.value = time * 0.001 * rotationSpeed;
            material.uniforms.uPointer.value.set(pointerRef.current.x, pointerRef.current.y);
            renderer.render(scene, camera);
          }
          frameId = window.requestAnimationFrame(render);
        };
        render();
      } catch {
        setFallback(true);
      }
    };

    const onPointerMove = (event) => {
      if (!interactive || !mount) return;
      const rect = mount.getBoundingClientRect();
      pointerRef.current = {
        x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((event.clientY - rect.top) / rect.height - 0.5) * -2,
      };
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(mount);

    if (interactive) mount.addEventListener('pointermove', onPointerMove, { passive: true });
    init();

    return () => {
      disposed = true;
      observer.disconnect();
      if (interactive) mount.removeEventListener('pointermove', onPointerMove);
      if (resizeObserver) resizeObserver.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
      if (scene && mesh) scene.remove(mesh);
      if (geometry) geometry.dispose();
      if (material) material.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss?.();
        renderer.domElement?.remove();
      }
    };
  }, [bottomColor, glowAmount, intensity, interactive, mixBlendMode, noiseIntensity, pillarHeight, pillarRotation, pillarWidth, quality, rotationSpeed, topColor]);

  return (
    <div className="rb-light-pillar" ref={mountRef} aria-hidden="true">
      {fallback && <div className="rb-light-pillar__fallback" />}
    </div>
  );
};

export default LightPillar;
