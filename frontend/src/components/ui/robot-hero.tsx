"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkles, ArrowRight, ChevronDown, Heart } from "lucide-react";
import { BrandLogo } from "../BrandLogo";

class HeartCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }
  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    t = t * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);

    return optionalTarget.set(x * 0.002, (y + 6) * 0.002, 0);
  }
}

const sharedHeartCurve = new HeartCurve();

function ResponsiveGroup({
  children,
  scale = 1,
}: {
  children: React.ReactNode;
  scale?: number;
}) {
  const { viewport, size } = useThree();
  const isMobile = size.width < 768;
  const isSmallMobile = size.width < 450;

  // Responsive scale & position: on mobile, position robot higher up so it floats
  // proudly in the hero stage area above the headline without being obscured
  const responsiveScale = (isSmallMobile ? 0.78 : isMobile ? 0.9 : Math.min(1.1, viewport.width / 3.5)) * scale;
  const yOffset = isSmallMobile ? 0.55 : isMobile ? 0.35 : 0;

  return (
    <group position={[0, yOffset, 0]} scale={responsiveScale}>
      {children}
    </group>
  );
}

function GlassCapsule({
  color,
  power,
  intensity,
}: {
  color: string;
  power: number;
  intensity: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      color: { value: new THREE.Color("#ffffff") },
      power: { value: 2.5 },
      intensity: { value: 0.6 },
    }),
    [],
  );

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.color.value.set(color);
      materialRef.current.uniforms.power.value = power;
      materialRef.current.uniforms.intensity.value = intensity;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[0.3, 64, 64, 0, Math.PI * 2, 0, Math.PI]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform vec3 color;
          uniform float power;
          uniform float intensity;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
            fresnel = pow(fresnel, power);
            gl_FragColor = vec4(color, fresnel * intensity);
          }
        `}
        transparent={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

const earBaseMat = new THREE.MeshStandardMaterial({
  color: "#f0f0f0",
  roughness: 0.5,
});
const earRingMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.3,
});
const earCenterMat = new THREE.MeshStandardMaterial({
  color: "#cccccc",
  roughness: 0.8,
});
const antennaBaseMat = new THREE.MeshStandardMaterial({
  color: "#999999",
  roughness: 0.4,
  metalness: 0.5,
});
const antennaStickMat = new THREE.MeshStandardMaterial({
  color: "#d0d0d0",
  roughness: 0.4,
  metalness: 0.2,
});
const antennaTipMat = new THREE.MeshStandardMaterial({
  color: "#ff3366",
  roughness: 0.2,
  toneMapped: false,
});

function RobotEar({
  position,
  scale = 1,
  isLeft = false,
}: {
  position: [number, number, number];
  scale?: number;
  isLeft?: boolean;
}) {
  const dir = isLeft ? -1 : 1;

  return (
    <group position={position} scale={scale}>
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
        material={earBaseMat}
      >
        <cylinderGeometry args={[0.04, 0.04, 0.025, 32]} />
      </mesh>

      <mesh
        position={[dir * 0.012, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
        material={earRingMat}
      >
        <torusGeometry args={[0.032, 0.008, 16, 32]} />
      </mesh>

      <mesh
        position={[dir * 0.012, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
        material={earCenterMat}
      >
        <cylinderGeometry args={[0.03, 0.03, 0.005, 32]} />
      </mesh>

      <group position={[dir * 0.015, 0.035, 0]} rotation={[-0.4, 0, 0]}>
        <mesh
          position={[0, 0.01, 0]}
          castShadow
          receiveShadow
          material={antennaBaseMat}
        >
          <cylinderGeometry args={[0.006, 0.008, 0.02, 16]} />
        </mesh>
        <mesh
          position={[0, 0.06, 0]}
          castShadow
          receiveShadow
          material={antennaStickMat}
        >
          <cylinderGeometry args={[0.003, 0.003, 0.1, 8]} />
        </mesh>
        <mesh
          position={[0, 0.11, 0]}
          castShadow
          receiveShadow
          material={antennaTipMat}
        >
          <sphereGeometry args={[0.006, 16, 16]} />
        </mesh>
      </group>
    </group>
  );
}

const eyeMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(2, 2, 2),
  toneMapped: false,
  transparent: true,
});
const heartMat = new THREE.MeshBasicMaterial({
  color: "#ff3366",
  toneMapped: false,
});

function RobotEye({
  position,
  rotation,
  scale = 1,
  blinkDuration = 0.15,
  blinkCycle = 3.0,
  isLovedRef,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  blinkDuration?: number;
  blinkCycle?: number;
  isLovedRef: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const normalEyesRef = useRef<THREE.Group>(null);
  const heartEyeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !normalEyesRef.current || !heartEyeRef.current)
      return;

    const isHeart = isLovedRef.current;

    normalEyesRef.current.visible = !isHeart;
    heartEyeRef.current.visible = isHeart;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cycle = clock.getElapsedTime() % blinkCycle;

    let targetScaleY = 1;

    if (!prefersReducedMotion && cycle < blinkDuration && !isHeart) {
      const progress = cycle / blinkDuration;
      const blinkClose = Math.sin(progress * Math.PI);

      targetScaleY = Math.max(0.05, 1.0 - blinkClose);
    }

    if (isHeart && heartEyeRef.current) {
      if (prefersReducedMotion) {
        heartEyeRef.current.scale.set(1.1, 1.1, 1.1);
      } else {
        // Animated, rhythmic heartbeat pulse: double-beat lub-dub cycle
        const t = clock.getElapsedTime() * 11;
        const beat = 1 + 0.24 * Math.pow(Math.sin(t), 4);
        heartEyeRef.current.scale.set(beat, beat, beat);
      }
    }

    groupRef.current.scale.set(scale, scale * targetScaleY, scale);
  });

  const { topPath, bottomPath } = useMemo(() => {
    const w = 0.025;
    const h = 0.035;
    const r = 0.02;
    const g = 0.005;

    const tPath = new THREE.CurvePath<THREE.Vector3>();
    tPath.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-w, g, 0),
        new THREE.Vector3(-w, h - r, 0),
      ),
    );
    tPath.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-w, h - r, 0),
        new THREE.Vector3(-w, h, 0),
        new THREE.Vector3(-w + r, h, 0),
      ),
    );
    tPath.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-w + r, h, 0),
        new THREE.Vector3(w - r, h, 0),
      ),
    );
    tPath.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(w - r, h, 0),
        new THREE.Vector3(w, h, 0),
        new THREE.Vector3(w, h - r, 0),
      ),
    );
    tPath.add(
      new THREE.LineCurve3(
        new THREE.Vector3(w, h - r, 0),
        new THREE.Vector3(w, g, 0),
      ),
    );

    const bPath = new THREE.CurvePath<THREE.Vector3>();
    bPath.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-w, -g, 0),
        new THREE.Vector3(-w, -(h - r), 0),
      ),
    );
    bPath.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-w, -(h - r), 0),
        new THREE.Vector3(-w, -h, 0),
        new THREE.Vector3(-w + r, -h, 0),
      ),
    );
    bPath.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-w + r, -h, 0),
        new THREE.Vector3(w - r, -h, 0),
      ),
    );
    bPath.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(w - r, -h, 0),
        new THREE.Vector3(w, -h, 0),
        new THREE.Vector3(w, -(h - r), 0),
      ),
    );
    bPath.add(
      new THREE.LineCurve3(
        new THREE.Vector3(w, -(h - r), 0),
        new THREE.Vector3(w, -g, 0),
      ),
    );

    return { topPath: tPath, bottomPath: bPath };
  }, []);

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <mesh ref={heartEyeRef} visible={false} material={heartMat}>
        <tubeGeometry args={[sharedHeartCurve, 64, 0.0035, 8, true]} />
      </mesh>

      <group ref={normalEyesRef}>
        <mesh material={eyeMat}>
          <tubeGeometry args={[topPath, 20, 0.0035, 8, false]} />
        </mesh>
        <mesh material={eyeMat}>
          <tubeGeometry args={[bottomPath, 20, 0.0035, 8, false]} />
        </mesh>
      </group>
    </group>
  );
}

function generatePbrTexturesAsync(): Promise<{
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const size = 512;
      const canvasC = document.createElement("canvas");
      const canvasB = document.createElement("canvas");
      canvasC.width = canvasB.width = size;
      canvasC.height = canvasB.height = size;
      const ctxC = canvasC.getContext("2d");
      const ctxB = canvasB.getContext("2d");

      if (ctxC && ctxB) {
        ctxC.fillStyle = "#dcdcdc";
        ctxC.fillRect(0, 0, size, size);
        ctxB.fillStyle = "#808080";
        ctxB.fillRect(0, 0, size, size);

        for (let i = 0; i < 10000; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const r = 0.5 + Math.random() * 1.5;
          const isDark = Math.random() > 0.15;

          ctxC.beginPath();
          ctxC.arc(x, y, r, 0, Math.PI * 2);
          ctxC.fillStyle = isDark ? "#222222" : "#dddddd";
          ctxC.fill();

          ctxB.beginPath();
          ctxB.arc(x, y, r, 0, Math.PI * 2);
          ctxB.fillStyle = isDark ? "#000000" : "#ffffff";
          ctxB.fill();
        }
      }

      const texC = new THREE.CanvasTexture(canvasC);
      const texB = new THREE.CanvasTexture(canvasB);
      texC.wrapS = texB.wrapS = THREE.RepeatWrapping;
      texC.wrapT = texB.wrapT = THREE.RepeatWrapping;

      texC.repeat.set(6, 3);
      texB.repeat.set(6, 3);
      texC.needsUpdate = true;
      texB.needsUpdate = true;

      resolve({ colorMap: texC, bumpMap: texB });
    }, 0);
  });
}

function RobotPrototype({
  neckParams = {
    baseR: 0.25,
    baseH: -0.01,
    midR: 0.23,
    midH: 0.02,
    lipBottomR: 0.27,
    lipBottomH: 0.025,
    lipTopR: 0.28,
    lipTopH: 0.05,
    innerR: 0.24,
    innerDropH: 0.03,
  },
  bodyParams = { bodyBevelR: 0.21, bodyBevelY: 0.38, bodyBevelT: 0.015 },
  color = "#c4c4c4",
  pantallaColor = "#00ffc6",
  pantallaBrillo = 1.2,
  blinkCycle = 3.0,
  metalness = 0.0,
}: {
  neckParams?: Record<string, number>;
  bodyParams?: Record<string, number>;
  color?: string;
  pantallaColor?: string;
  pantallaBrillo?: number;
  blinkCycle?: number;
  metalness?: number;
}) {
  const isLovedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const [textures, setTextures] = useState<{
    colorMap: THREE.CanvasTexture | null;
    bumpMap: THREE.CanvasTexture | null;
  }>({ colorMap: null, bumpMap: null });

  const design = {
    pantallaColor: pantallaColor,
    pantallaGrosor: 3.8,
    pantallaBrillo: pantallaBrillo,
    separacionOjos: 0.07,
    tamañoOrejas: 1.3,
    escalaOjos: 1.1,
    parpadeoFrecuencia: blinkCycle,
    parpadeoDuracion: 0.45,
    colorChasis: color,
    alturaCabeza: 0.6,
  };

  const config = {
    moveSpeed: 3.2,
    bodyRotSpeed: 8.0,
    headRotSpeed: 14.0,
    bodyTiltX: 0.12,
    bodyTiltY: 0.95,
    headLookX: 0.45,
    headLookY: 1.8,
  };

  useFrame((state, delta) => {
    if (!bodyRef.current || !headRef.current) return;

    const dt = Math.min(delta, 0.1);
    const time = state.clock.getElapsedTime();

    // Respect accessibility prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Organic idle floating hover and ambient breathing motion
    // Operates continuously even when pointer is stationary or on touchscreens
    const floatY = prefersReducedMotion ? 0 : Math.sin(time * 1.8) * 0.07;
    const ambientSwayZ = prefersReducedMotion ? 0 : Math.sin(time * 1.2) * 0.025;
    const ambientBreathX = prefersReducedMotion ? 0 : Math.cos(time * 1.5) * 0.02;
    const ambientHeadLookY = prefersReducedMotion ? 0 : Math.sin(time * 0.9) * 0.06;

    // Cheerful tap/click bounce when heart eyes are active (suppressed under reduced-motion)
    const loveBounce =
      !prefersReducedMotion && isLovedRef.current
        ? Math.sin(time * 14) * 0.04
        : 0;

    // Pointer-following motion: disabled under reduced-motion to prevent vestibular discomfort
    const tx = prefersReducedMotion ? 0 : state.pointer.x;
    const ty = prefersReducedMotion ? 0 : state.pointer.y;

    const maxMoveX = state.viewport.width / 3.8;
    const targetPosX = tx * maxMoveX;

    // Smooth position interpolation (X translation with cursor, Y floating bob)
    bodyRef.current.position.x = THREE.MathUtils.lerp(
      bodyRef.current.position.x,
      targetPosX,
      config.moveSpeed * dt,
    );
    bodyRef.current.position.y = THREE.MathUtils.lerp(
      bodyRef.current.position.y,
      -0.3 + floatY + loveBounce,
      5.0 * dt,
    );

    const relativeX = tx - bodyRef.current.position.x / 2.5;

    const bodyTargetRotY = -relativeX * config.bodyTiltY + ambientHeadLookY * 0.5;
    const bodyTargetRotX =
      relativeX * relativeX * config.bodyTiltX - ty * 0.25 + ambientBreathX;
    const bodyTargetRotZ = -relativeX * 0.15 + ambientSwayZ;

    bodyRef.current.rotation.y = THREE.MathUtils.lerp(
      bodyRef.current.rotation.y,
      bodyTargetRotY,
      config.bodyRotSpeed * dt,
    );
    bodyRef.current.rotation.x = THREE.MathUtils.lerp(
      bodyRef.current.rotation.x,
      bodyTargetRotX,
      config.bodyRotSpeed * dt,
    );
    bodyRef.current.rotation.z = THREE.MathUtils.lerp(
      bodyRef.current.rotation.z,
      bodyTargetRotZ,
      config.bodyRotSpeed * dt,
    );

    const headTargetRotY = relativeX * config.headLookY + ambientHeadLookY;
    const headTargetRotX = -ty * config.headLookX + ambientBreathX * 0.8;

    headRef.current.rotation.y = THREE.MathUtils.lerp(
      headRef.current.rotation.y,
      headTargetRotY,
      config.headRotSpeed * dt,
    );
    headRef.current.rotation.x = THREE.MathUtils.lerp(
      headRef.current.rotation.x,
      headTargetRotX,
      config.headRotSpeed * dt,
    );
  });

  useEffect(() => {
    let mounted = true;
    let generatedMaps: {
      colorMap: THREE.CanvasTexture;
      bumpMap: THREE.CanvasTexture;
    } | null = null;

    generatePbrTexturesAsync().then((res) => {
      if (mounted) {
        generatedMaps = res;
        setTextures(res);
      } else {
        res.colorMap.dispose();
        res.bumpMap.dispose();
      }
    });

    return () => {
      mounted = false;

      if (generatedMaps) {
        generatedMaps.colorMap.dispose();
        generatedMaps.bumpMap.dispose();
      }
    };
  }, []);

  const handlePointerDown = (
    e: import("@react-three/fiber").ThreeEvent<PointerEvent>,
  ) => {
    e.stopPropagation();
    isLovedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      isLovedRef.current = false;
    }, 2800);
  };

  const neckProfile = useMemo(() => {
    const points = [];

    points.push(new THREE.Vector2(neckParams.innerR, neckParams.baseH));

    points.push(new THREE.Vector2(neckParams.baseR, neckParams.baseH));

    points.push(new THREE.Vector2(neckParams.midR, neckParams.midH));

    points.push(
      new THREE.Vector2(neckParams.lipBottomR, neckParams.lipBottomH),
    );

    points.push(new THREE.Vector2(neckParams.lipTopR, neckParams.lipTopH));

    points.push(new THREE.Vector2(neckParams.innerR, neckParams.lipTopH));

    points.push(
      new THREE.Vector2(
        neckParams.innerR,
        neckParams.lipTopH - neckParams.innerDropH,
      ),
    );
    return points;
  }, [neckParams]);

  const headMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "#111111",
      roughness: 1.0,
      metalness: 0.0,
    });
  }, []);

  if (!textures.colorMap) return null;

  return (
    <group
      ref={bodyRef}
      position={[0, -0.3, 0]}
      onPointerDown={handlePointerDown}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <mesh castShadow receiveShadow>
        <sphereGeometry
          args={[0.43, 64, 64, 0, Math.PI * 2, Math.PI * 0.15, Math.PI * 0.85]}
        />
        <meshStandardMaterial
          color={design.colorChasis}
          map={textures.colorMap || undefined}
          bumpMap={textures.bumpMap || undefined}
          bumpScale={0.005}
          roughness={1.0}
          metalness={metalness}
          envMapIntensity={0.0}
        />
      </mesh>

      {bodyParams.bodyBevelT > 0 && (
        <mesh
          position={[0, bodyParams.bodyBevelY, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <torusGeometry
            args={[bodyParams.bodyBevelR, bodyParams.bodyBevelT, 32, 64]}
          />
          <meshStandardMaterial
            color={design.colorChasis}
            map={textures.colorMap || undefined}
            bumpMap={textures.bumpMap || undefined}
            bumpScale={0.005}
            roughness={1.0}
            metalness={metalness}
            envMapIntensity={0.0}
          />
        </mesh>
      )}

      <mesh position={[0, 0.38, 0]} receiveShadow castShadow>
        <latheGeometry args={[neckProfile, 64]} />
        <meshStandardMaterial
          color={design.colorChasis}
          map={textures.colorMap || undefined}
          bumpMap={textures.bumpMap || undefined}
          bumpScale={0.005}
          roughness={1.0}
          metalness={metalness}
          envMapIntensity={0.0}
        />
      </mesh>

      <group ref={headRef} position={[0, design.alturaCabeza, 0]}>
        <mesh material={headMat} castShadow receiveShadow>
          <sphereGeometry args={[0.28, 64, 64, 0, Math.PI * 2, 0, Math.PI]} />
        </mesh>

        <GlassCapsule
          color={design.pantallaColor}
          power={design.pantallaGrosor}
          intensity={design.pantallaBrillo}
        />

        <group position={[0, -0.02, 0.29]}>
          <RobotEye
            position={[-design.separacionOjos, 0, 0]}
            rotation={[0, -0.2, 0]}
            scale={design.escalaOjos}
            blinkDuration={design.parpadeoDuracion}
            blinkCycle={design.parpadeoFrecuencia}
            isLovedRef={isLovedRef}
          />
          <RobotEye
            position={[design.separacionOjos, 0, 0]}
            rotation={[0, 0.2, 0]}
            scale={design.escalaOjos}
            blinkDuration={design.parpadeoDuracion}
            blinkCycle={design.parpadeoFrecuencia}
            isLovedRef={isLovedRef}
          />
        </group>

        <RobotEar
          position={[-0.29, 0, 0]}
          isLeft={true}
          scale={design.tamañoOrejas}
        />
        <RobotEar
          position={[0.29, 0, 0]}
          isLeft={false}
          scale={design.tamañoOrejas}
        />
      </group>
    </group>
  );
}

export interface NavItem {
  label: string;
  href?: string;
  target?: string;
  onClick?: () => void;
  active?: boolean;
}

export interface RobotHeroProps {
  backgroundText?: string;
  navItemsLeft?: NavItem[];
  contactText?: string;
  contactHref?: string;
  contactTarget?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  color?: string;
  scale?: number;
  pantallaColor?: string;
  pantallaBrillo?: number;
  blinkCycle?: number;
  metalness?: number;
}

function AntennaNavbar({
  leftItems,
  contactText,
  contactHref,
  contactTarget,
  ctaText,
  onCtaClick,
}: {
  leftItems: NavItem[];
  contactText: string;
  contactHref: string;
  contactTarget?: string;
  ctaText: string;
  onCtaClick?: () => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { scrollY } = useScroll();
  const lineOpacity = useTransform(scrollY, [0, 50], [1, 0]);

  return (
    <nav className="sticky top-0 z-50 w-full pt-3 sm:pt-6 px-3 sm:px-8 pointer-events-none">
      <div className="w-full max-w-[1400px] mx-auto flex flex-col relative pointer-events-auto">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between relative gap-2 sm:gap-4 lg:gap-0 bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-2xl lg:rounded-full px-3.5 sm:px-6 py-2 sm:py-3 shadow-lg shadow-slate-200/50">
          {/* Top/Main Row: Logo + Primary CTA on mobile, or full left side on desktop */}
          <div className="flex items-center justify-between lg:justify-start gap-3 sm:gap-5 z-20">
            <BrandLogo size="sm" showTagline={false} />
            <div className="h-5 w-px bg-slate-200 hidden md:block" />

            {/* Desktop Left Nav Links */}
            <div className="hidden lg:flex items-center gap-1 sm:gap-2">
              {leftItems.map((item, idx) => {
                const isSelected = item.active || hoveredIndex === idx;
                const linkClass = `relative px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors overflow-hidden cursor-pointer ${
                  item.active
                    ? "bg-sky-50 text-blue-700 border border-sky-300"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`;

                const itemContent = (
                  <>
                    <span>{item.label}</span>
                    {isSelected && (
                      <motion.div
                        layoutId="navbar-indicator-left"
                        className="absolute inset-0 border-b-2 border-blue-600"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </>
                );

                if (item.onClick) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className={linkClass}
                    >
                      {itemContent}
                    </button>
                  );
                }

                return (
                  <a
                    key={item.label}
                    href={item.href || "#"}
                    target={item.target}
                    rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={linkClass}
                  >
                    {itemContent}
                  </a>
                );
              })}
            </div>

            {/* Mobile Header Right CTA */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                type="button"
                onClick={onCtaClick}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white text-xs font-bold shadow-sm shadow-blue-500/25 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
              >
                <span>{ctaText}</span>
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation Links Row (compact pill row for mobile) */}
          <div className="flex lg:hidden items-center justify-start sm:justify-center gap-1.5 pt-1.5 pb-0.5 border-t border-slate-100/80 overflow-x-auto max-w-full px-1">
            {leftItems.map((item) => {
              const linkClass = `px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[32px] inline-flex items-center ${
                item.active
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`;
              if (item.onClick) {
                return (
                  <button key={item.label} type="button" onClick={item.onClick} className={linkClass}>
                    {item.label}
                  </button>
                );
              }
              return (
                <a key={item.label} href={item.href || "#"} target={item.target} className={linkClass}>
                  {item.label}
                </a>
              );
            })}
            <a
              href={contactHref}
              target={contactTarget}
              rel={contactTarget === "_blank" ? "noopener noreferrer" : undefined}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900 whitespace-nowrap min-h-[32px] inline-flex items-center"
            >
              {contactText}
            </a>
          </div>

          {/* Center Mascot Emblem (Desktop only) */}
          <div 
            onClick={onCtaClick}
            className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center pointer-events-auto cursor-pointer group z-10"
            title="Explore RAG App"
          >
            <div className="relative flex items-center justify-center h-10 w-14">
              <div className="absolute left-1 w-1 h-3 bg-blue-500/60 rounded-l-md transition-transform duration-300 group-hover:-translate-x-1" />
              <div className="absolute right-1 w-1 h-3 bg-blue-500/60 rounded-r-md transition-transform duration-300 group-hover:translate-x-1" />

              <div className="z-10 w-9 h-9 bg-white border border-sky-300 backdrop-blur-md rounded-xl flex items-center justify-center shadow-md shadow-sky-500/20 transition-all duration-300 group-hover:border-blue-500 group-hover:shadow-lg">
                <div className="w-[70%] h-[60%] bg-slate-900 rounded-lg flex items-center justify-center gap-1 overflow-hidden shadow-inner">
                  <div className="w-1.5 h-2.5 bg-[#00ffc6] rounded-[2px] shadow-[0_0_8px_#00ffc6] transition-transform duration-200 group-hover:scale-y-[0.3]" />
                  <div className="w-1.5 h-2.5 bg-[#00ffc6] rounded-[2px] shadow-[0_0_8px_#00ffc6] transition-transform duration-200 group-hover:scale-y-[0.3]" />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden lg:flex justify-end items-center gap-2 sm:gap-3 w-full lg:w-auto z-20">
            <a
              href={contactHref}
              target={contactTarget}
              rel={contactTarget === "_blank" ? "noopener noreferrer" : undefined}
              className="px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:border-slate-400 text-xs font-semibold transition-all shadow-xs"
            >
              {contactText}
            </a>
            <button
              onClick={onCtaClick}
              className="px-5 sm:px-6 py-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white text-xs sm:text-sm font-black hover:opacity-95 transition-all flex items-center gap-2 shadow-md shadow-blue-500/25 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>{ctaText}</span>
              <Sparkles className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <motion.div
          style={{ opacity: lineOpacity }}
          className="w-full mt-3 sm:mt-4 border-b border-slate-200"
        />
      </div>
    </nav>
  );
}

export function RobotHero({
  backgroundText = "KIVO AI",
  navItemsLeft = [
    { label: "Overview", href: "#overview" },
    { label: "Features", href: "#features" },
    { label: "Knowledge Base", href: "#rag-workspace" },
  ],
  contactText = "API Docs",
  contactHref = "http://127.0.0.1:8000/docs",
  contactTarget = "_blank",
  ctaText = "Explore RAG App",
  onCtaClick,
  color = "#c8d0dc",
  scale = 1,
  pantallaColor = "#00ffc6",
  pantallaBrillo = 1.6,
  blinkCycle = 3.0,
  metalness = 0.15,
}: RobotHeroProps = {}) {
  const containerRef = useRef<HTMLElement>(null);

  const entorno = {
    fondoArriba: "#ffffff",
    fondoMedio: "#f8fafc",
    fondoAbajo: "#f1f5f9",
    luzAmbiente: 1.6,
    luzPrincipal: 2.2,
    luzPrincipalColor: "#0284c7",
    luzRelleno: 1.8,
    luzRellenoColor: "#38bdf8",
    sombraOpacidad: 0.35,
    sombraBlur: 2.2,
  };

  return (
    <section
      ref={containerRef}
      className="relative w-full min-h-screen overflow-hidden flex flex-col justify-between"
      style={{
        background: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(14, 165, 233, 0.12), transparent), radial-gradient(ellipse 60% 50% at 50% 110%, rgba(99, 102, 241, 0.08), transparent), linear-gradient(to bottom, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)`,
      }}
    >
      {/* Background Cyber Grid subtle pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `linear-gradient(rgba(14, 165, 233, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.06) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Watermark Branding element integrated into design */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <div className="relative flex flex-col items-center select-none -translate-y-8">
          <h1
            className="font-sans font-black select-none whitespace-nowrap tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-slate-900/[0.08] via-sky-500/[0.04] to-transparent"
            style={{
              fontSize: "clamp(5rem, 18vw, 15rem)",
              lineHeight: 1,
              textShadow: "0 0 80px rgba(14, 165, 233, 0.08)",
            }}
          >
            {backgroundText}
          </h1>
          <div className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.4em] text-sky-700/40 -mt-4 sm:-mt-8">
            Intelligent Document Assistant
          </div>
        </div>
      </div>

      {/* 3D Interactive Robot Canvas */}
      <div className="absolute inset-0 z-10">
        <Canvas shadows camera={{ position: [0, 0.2, 6], fov: 40 }}>
          <ambientLight intensity={entorno.luzAmbiente} color="#ffffff" />

          <directionalLight
            position={[0, 6, 3]}
            intensity={entorno.luzPrincipal}
            color={entorno.luzPrincipalColor}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0005}
          >
            <orthographicCamera
              attach="shadow-camera"
              args={[-1.5, 1.5, 1.5, -1.5, 0.1, 20]}
            />
          </directionalLight>

          <directionalLight
            position={[-5, 2, -5]}
            intensity={entorno.luzRelleno}
            color={entorno.luzRellenoColor}
          />

          <directionalLight
            position={[0, -2, -3]}
            intensity={1.2}
            color="#38bdf8"
          />

          <Environment preset="studio" blur={0.5} />

          <ResponsiveGroup scale={scale}>
            <ContactShadows
              position={[0, -0.79, 0]}
              opacity={entorno.sombraOpacidad}
              scale={15}
              resolution={1024}
              blur={entorno.sombraBlur}
              far={2.5}
              color="#0284c7"
            />
            <RobotPrototype
              neckParams={{
                baseR: 0.215,
                baseH: -0.05,
                midR: 0.28,
                midH: 0.02,
                lipBottomR: 0.295,
                lipBottomH: 0.045,
                lipTopR: 0.27,
                lipTopH: 0.055,
                innerR: 0.1,
                innerDropH: 0.0,
              }}
              bodyParams={{
                bodyBevelR: 0.235,
                bodyBevelY: 0.34,
                bodyBevelT: 0.025,
              }}
              color={color}
              pantallaColor={pantallaColor}
              pantallaBrillo={pantallaBrillo}
              blinkCycle={blinkCycle}
              metalness={metalness}
            />
          </ResponsiveGroup>
        </Canvas>
      </div>

      {/* Hero UI Overlay with Navbar and Compelling Content */}
      <div className="relative z-20 pointer-events-none flex flex-col justify-between min-h-screen">
        <AntennaNavbar
          leftItems={navItemsLeft}
          contactText={contactText}
          contactHref={contactHref}
          contactTarget={contactTarget}
          ctaText={ctaText}
          onCtaClick={onCtaClick}
        />

        <div className="w-full max-w-[1400px] mx-auto px-3.5 sm:px-8 flex-1 flex flex-col justify-end pb-6 sm:pb-12 pointer-events-none">
          <div className="flex flex-col lg:flex-row items-center lg:items-end justify-between gap-5 sm:gap-6 pointer-events-auto">
            {/* Left Hero Copy */}
            <div className="max-w-xl text-center lg:text-left w-full">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[10px] sm:text-xs font-semibold mb-2 sm:mb-3 backdrop-blur-md shadow-xs max-w-full">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping flex-shrink-0" />
                <span className="truncate">Autonomous RAG Engine &amp; 3D Neural Mascot</span>
              </div>

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight sm:leading-[1.1] mb-2 sm:mb-3 break-words">
                Intelligent Document Assistant with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500">Exact Citations</span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4 sm:mb-5 max-w-xl mx-auto lg:mx-0">
                Interrogate multi-page PDFs, technical manuals, and research papers with zero hallucination. Powered by NumPy vector embeddings, sub-second semantic retrieval, and exact page-level coordinate references.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-2.5 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onCtaClick}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white font-black text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer min-h-[44px]"
                >
                  <span>Explore RAG App</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <a
                  href="#features"
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
                >
                  <span>View Features</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </a>
              </div>
            </div>

            {/* Right Interactive Hints & Feature Badges */}
            <div className="flex flex-col items-center lg:items-end gap-2.5 sm:gap-3 text-center lg:text-right w-full lg:w-auto">
              {/* Interactive hint */}
              <div className="flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200 text-[10px] sm:text-[11px] text-slate-700 font-mono shadow-xs backdrop-blur-md max-w-full">
                <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse flex-shrink-0" />
                <span className="truncate">Move cursor or touch robot • Tap for heart eyes</span>
              </div>

              {/* Feature chips */}
              <div className="flex flex-wrap justify-center lg:justify-end gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-semibold text-slate-600">
                <span className="px-2.5 sm:px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-xs">
                  <span className="text-emerald-500">●</span> 100% Grounded Citations
                </span>
                <span className="px-2.5 sm:px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-xs">
                  <span className="text-blue-500">●</span> Sub-second NumPy Search
                </span>
                <span className="px-2.5 sm:px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 shadow-xs">
                  <span className="text-indigo-500">●</span> Exact Page Coordinates
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default RobotHero;
