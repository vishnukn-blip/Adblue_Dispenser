import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface Site3DTankTwinProps {
  todayDispensedTotal?: number;
  activeDispenserBay?: number;
  isDispensing?: boolean;
  onClose?: () => void;
  isModal?: boolean;
}

// Helper: Generate dynamic canvas texture for Tank Decal
function createTankDecalTexture(tankNum: number, volume: number, pct: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Background
  ctx.fillStyle = "#0c1a3b";
  ctx.fillRect(0, 0, 1024, 512);

  // Outer border with cyan glow
  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 1024 - 28, 512 - 28);

  // Inner subtle border
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, 1024 - 60, 512 - 60);

  // Almarai Header Ribbon
  ctx.fillStyle = "#0284c7";
  ctx.fillRect(34, 34, 1024 - 68, 70);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ALMARAI KHARJ • ADBLUE DEF BULK STORAGE", 512, 82);

  // Tank Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(`BULK TANK 0${tankNum}`, 512, 175);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 28px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("RATED CAPACITY: 30,000 LITRES", 512, 220);

  // Digital Volume Display Panel
  ctx.fillStyle = "#020b1e";
  ctx.roundRect ? ctx.roundRect(160, 255, 704, 140, 16) : ctx.fillRect(160, 255, 704, 140);
  ctx.fill();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Digital Readout
  ctx.fillStyle = "#38bdf8";
  ctx.font = "900 68px 'JetBrains Mono', 'Courier New', monospace";
  ctx.fillText(`${volume.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`, 512, 340);

  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(`● STATUS: NORMAL • ${pct.toFixed(1)}% CAPACITY`, 512, 380);

  // Subtext footer
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 22px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("ISO 22241-1 ADBLUE DEF • SS316L DUAL WALL • RADAR TELEMETRY", 512, 455);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

// Helper: Generate dynamic canvas texture for Bay Overhead Header
function createBayHeaderTexture(bayNum: number, isActive: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  if (isActive) {
    grad.addColorStop(0, "#0284c7");
    grad.addColorStop(1, "#0369a1");
  } else {
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(1, "#0f172a");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = isActive ? "#38bdf8" : "#475569";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 500, 244);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 110px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`BAY ${bayNum < 10 ? "0" + bayNum : bayNum}`, 256, 140);

  ctx.fillStyle = isActive ? "#38bdf8" : "#94a3b8";
  ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(isActive ? "● DISPENSING DEF" : "● READY / IDLE", 256, 205);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

// Helper: Generate dynamic canvas texture for Dispenser LCD Screen
function createDispenserLcdTexture(bayNum: number, isActive: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#020817";
  ctx.fillRect(0, 0, 512, 384);

  ctx.strokeStyle = isActive ? "#38bdf8" : "#1e293b";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 376);

  ctx.fillStyle = "#0284c7";
  ctx.fillRect(8, 8, 496, 50);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NIMBLE VISION • ADBLUE DEF", 256, 42);

  ctx.textAlign = "left";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("VOLUME DISPENSED:", 40, 105);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "900 64px 'JetBrains Mono', monospace";
  ctx.fillText(isActive ? "45.24 L" : "0.00 L", 40, 175);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("PRICE / LITRE: SAR 2.10", 40, 230);
  ctx.fillText("PRODUCT GRADE: ADBLUE DEF", 40, 268);

  ctx.fillStyle = isActive ? "#22c55e" : "#0284c7";
  ctx.fillRect(40, 305, 432, 45);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(isActive ? "PUMP ACTIVE & METERING" : "NOZZLE DOCKED • READY", 256, 337);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

// Helper: Generate Hazard Chevron Stripes
function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#eab308";
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = "#0f172a";
  for (let x = -64; x < 320; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x - 8, 64);
    ctx.lineTo(x - 24, 64);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 1);
  return texture;
}

// Helper: Generate Asphalt Forecourt Road Markings
function createForecourtFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#182030";
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  for (let x = 0; x <= 1024; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(2, 132, 199, 0.08)";
  ctx.fillRect(64, 450, 896, 120);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 12]);
  for (let x = 80; x < 950; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 600);
    ctx.lineTo(x, 900);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  for (let x = 120; x < 950; x += 85) {
    ctx.beginPath();
    ctx.moveTo(x, 780);
    ctx.lineTo(x - 12, 810);
    ctx.lineTo(x - 4, 810);
    ctx.lineTo(x - 4, 840);
    ctx.lineTo(x + 4, 840);
    ctx.lineTo(x + 4, 810);
    ctx.lineTo(x + 12, 810);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

// Helper: Generate 3D Floating Interactive Sprite Badge
function createFloatingBadgeSprite(title: string, sub: string, icon: string, accentColor: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Sprite();

  ctx.fillStyle = "rgba(11, 19, 41, 0.92)";
  ctx.roundRect ? ctx.roundRect(10, 10, 492, 140, 24) : ctx.fillRect(10, 10, 492, 140);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(80, 80, 45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(icon, 80, 95);

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(title, 150, 72);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(sub, 150, 114);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(9.5, 3.0, 1);
  return sprite;
}

// Helper: Generate Dynamic Flowmeter Badge that updates live without rebuilding Three.js scene
function createDynamicFlowmeterSprite(): {
  sprite: THREE.Sprite;
  update: (isOpen: boolean, flowRate1: number, flowRate2: number) => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 540;
  canvas.height = 190;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(10.5, 3.7, 1);

  const update = (isOpen: boolean, flowRate1: number, flowRate2: number) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, 540, 190);

    const accentColor = isOpen ? "#10b981" : "#f59e0b";

    // Card background
    ctx.fillStyle = "rgba(11, 19, 41, 0.95)";
    ctx.roundRect ? ctx.roundRect(10, 10, 520, 170, 20) : ctx.fillRect(10, 10, 520, 170);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Icon circle
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(65, 95, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚡", 65, 108);

    // Title
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("DUAL OFFLOAD METERING SKID", 120, 50);

    // Line 1 (Tank 1)
    ctx.font = "bold 19px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = isOpen ? "#34d399" : "#38bdf8";
    const sub1 = isOpen
      ? `TANK 01 INLET: OPEN • ${flowRate1.toFixed(1)} L/min`
      : `TANK 01 INLET: CLOSED • 0.0 L/min`;
    ctx.fillText(sub1, 120, 94);

    // Line 2 (Tank 2)
    ctx.fillStyle = isOpen ? "#38bdf8" : "#94a3b8";
    const sub2 = isOpen
      ? `TANK 02 INLET: OPEN • ${flowRate2.toFixed(1)} L/min`
      : `TANK 02 INLET: CLOSED • 0.0 L/min`;
    ctx.fillText(sub2, 120, 138);

    texture.needsUpdate = true;
  };

  update(false, 0, 0);
  return { sprite, update };
}



export const Site3DTankTwin: React.FC<Site3DTankTwinProps> = ({
  todayDispensedTotal = 524.24,
  activeDispenserBay = 1,
  isDispensing = false,
  onClose,
  isModal = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Storage Tank Dynamic States (2 x 30,000 L = 60,000 L total)
  const TANK_CAPACITY = 30000;
  const [tank1Volume, setTank1Volume] = useState<number>(24850.0 - todayDispensedTotal * 0.5);
  const [tank2Volume, setTank2Volume] = useState<number>(26420.0 - todayDispensedTotal * 0.5);
  const [manifoldBalanced, setManifoldBalanced] = useState<boolean>(true);
  const [selectedEntity, setSelectedEntity] = useState<"tank1" | "tank2">("tank1");
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [simActiveFlow, setSimActiveFlow] = useState<boolean>(isDispensing);
  const [xRayMode, setXRayMode] = useState<boolean>(false);
  const [showBadges, setShowBadges] = useState<boolean>(true);
  const [isRefilling, setIsRefilling] = useState<boolean>(false);
  const [tank1RefillFlowRate, setTank1RefillFlowRate] = useState<number>(0);
  const [tank2RefillFlowRate, setTank2RefillFlowRate] = useState<number>(0);


  // Live refs for smooth animation frame updates
  const isRefillingRef = useRef<boolean>(false);
  const refillFlowRate1Ref = useRef<number>(0);
  const refillFlowRate2Ref = useRef<number>(0);
  const refillValve1LedRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const refillValve2LedRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const flowmeterSpriteUpdateRef = useRef<((isOpen: boolean, f1: number, f2: number) => void) | null>(null);
  const refillPoints1Ref = useRef<THREE.Points | null>(null);
  const refillPoints2Ref = useRef<THREE.Points | null>(null);

  // Automatically refill both tanks to full 30,000 L capacity
  const handleRefillBothTanks = () => {
    if (isRefilling) return;

    // If both tanks are already 100% full, reset them so user can test refill again
    if (tank1Volume >= TANK_CAPACITY - 50 && tank2Volume >= TANK_CAPACITY - 50) {
      setTank1Volume(24730.0);
      setTank2Volume(26300.0);
      setIsRefilling(false);
      isRefillingRef.current = false;
      setTank1RefillFlowRate(0);
      setTank2RefillFlowRate(0);
      refillFlowRate1Ref.current = 0;
      refillFlowRate2Ref.current = 0;
      return;
    }

    setIsRefilling(true);
    isRefillingRef.current = true;
    setTank1RefillFlowRate(274.5);
    setTank2RefillFlowRate(274.0);
    refillFlowRate1Ref.current = 274.5;
    refillFlowRate2Ref.current = 274.0;
    const start1 = tank1Volume;
    const start2 = tank2Volume;
    const target1 = TANK_CAPACITY;
    const target2 = TANK_CAPACITY;
    const duration = 2600; // 2.6s smooth filling animation
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      setTank1Volume(Math.round((start1 + (target1 - start1) * ease) * 10) / 10);
      setTank2Volume(Math.round((start2 + (target2 - start2) * ease) * 10) / 10);

      // Fluctuate flowmeter readings realistically around 270 - 278 L/min each
      const f1 = 274 + Math.sin(elapsed * 0.015) * 4.2;
      const f2 = 274 + Math.cos(elapsed * 0.015) * 4.2;
      setTank1RefillFlowRate(Math.round(f1 * 10) / 10);
      setTank2RefillFlowRate(Math.round(f2 * 10) / 10);
      refillFlowRate1Ref.current = Math.round(f1 * 10) / 10;
      refillFlowRate2Ref.current = Math.round(f2 * 10) / 10;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setTank1Volume(target1);
        setTank2Volume(target2);
        setIsRefilling(false);
        isRefillingRef.current = false;
        setTank1RefillFlowRate(0);
        setTank2RefillFlowRate(0);
        refillFlowRate1Ref.current = 0;
        refillFlowRate2Ref.current = 0;

        // Dynamic Real-time Tank History Entry Creation for both tanks
        const nowTimeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const nowDateStr = new Date().toLocaleDateString("en-GB");
        const added1 = Math.round((target1 - start1) * 10) / 10;
        const added2 = Math.round((target2 - start2) * 10) / 10;

        if (added1 > 0) {
          setTank1History((prev) => [
            {
              id: `T1-LIVE-${Date.now()}`,
              timestamp: `${nowDateStr} ${nowTimeStr} (Just Now)`,
              eventType: "REFILL",
              title: "⚡ Live Bulk Tanker Offload Delivery (Line 01)",
              volumeChange: +added1,
              startVolume: Math.round(start1 * 10) / 10,
              endVolume: target1,
              operatorOrWaybill: `WB-${Math.floor(100000 + Math.random() * 900000)} (Live Intake)`,
              details: "Automated bulk delivery offload completed @ 274.5 L/min",
              qualityCheck: "ISO 22241 Passed • 32.5% Urea Checked",
            },
            ...prev,
          ]);
        }

        if (added2 > 0) {
          setTank2History((prev) => [
            {
              id: `T2-LIVE-${Date.now()}`,
              timestamp: `${nowDateStr} ${nowTimeStr} (Just Now)`,
              eventType: "REFILL",
              title: "⚡ Live Bulk Tanker Offload Delivery (Line 02)",
              volumeChange: +added2,
              startVolume: Math.round(start2 * 10) / 10,
              endVolume: target2,
              operatorOrWaybill: `WB-${Math.floor(100000 + Math.random() * 900000)} (Live Intake)`,
              details: "Automated bulk delivery offload completed @ 274.0 L/min",
              qualityCheck: "ISO 22241 Passed • 32.5% Urea Checked",
            },
            ...prev,
          ]);
        }
      }
    };
    requestAnimationFrame(step);
  };

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    setSimActiveFlow(isDispensing);
  }, [isDispensing]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 920;
    const height = container.clientHeight || 620;

    // 1. SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090e1a);
    scene.fog = new THREE.FogExp2(0x090e1a, 0.007);
    sceneRef.current = scene;

    // 2. CAMERA (Elevated 3/4 isometric perspective filling the frame)
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 1200);
    camera.position.set(0, 30, 54);
    cameraRef.current = camera;

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 10;
    controls.maxDistance = 140;
    controls.target.set(0, 5, -2);
    controlsRef.current = controls;

    // 5. LIGHTING
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 1.3);
    scene.add(ambientLight);

    const mainSun = new THREE.DirectionalLight(0xffffff, 2.7);
    mainSun.position.set(45, 65, 40);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.width = 2048;
    mainSun.shadow.mapSize.height = 2048;
    mainSun.shadow.camera.near = 0.5;
    mainSun.shadow.camera.far = 180;
    mainSun.shadow.camera.left = -50;
    mainSun.shadow.camera.right = 50;
    mainSun.shadow.camera.top = 50;
    mainSun.shadow.camera.bottom = -50;
    mainSun.shadow.bias = -0.0005;
    scene.add(mainSun);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    fillLight.position.set(-45, 30, -35);
    scene.add(fillLight);

    const manifoldPoint = new THREE.PointLight(0x00e5ff, 3.5, 40);
    manifoldPoint.position.set(0, 7, -15);
    scene.add(manifoldPoint);

    const forecourtPoint = new THREE.PointLight(0x0284c7, 2.5, 30);
    forecourtPoint.position.set(0, 6, 12);
    scene.add(forecourtPoint);

    // 6. FORECOURT FLOOR & FOUNDATIONS
    const floorGeo = new THREE.PlaneGeometry(160, 130);
    const floorTex = createForecourtFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.8,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(140, 70, 0x1e3a8a, 0x1e293b);
    grid.position.y = 0.02;
    scene.add(grid);

    // TANK PAD CONCRETE PLINTH
    const tankPadWidth = 56;
    const tankPadDepth = 22;
    const tankPadHeight = 0.8;
    const tankPadGeo = new THREE.BoxGeometry(tankPadWidth, tankPadHeight, tankPadDepth);
    const tankPadMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.65,
      metalness: 0.2,
    });
    const tankPad = new THREE.Mesh(tankPadGeo, tankPadMat);
    tankPad.position.set(0, tankPadHeight / 2, -15);
    tankPad.receiveShadow = true;
    tankPad.castShadow = true;
    scene.add(tankPad);

    // Hazard Stripes on Pad Curb Edges
    const hazardTex = createHazardStripeTexture();
    const hazardMat = new THREE.MeshBasicMaterial({ map: hazardTex });

    const frontCurbGeo = new THREE.BoxGeometry(tankPadWidth + 0.2, 0.25, 0.6);
    const frontCurb = new THREE.Mesh(frontCurbGeo, hazardMat);
    frontCurb.position.set(0, tankPadHeight + 0.12, -15 + tankPadDepth / 2);
    scene.add(frontCurb);

    const backCurb = new THREE.Mesh(frontCurbGeo, hazardMat);
    backCurb.position.set(0, tankPadHeight + 0.12, -15 - tankPadDepth / 2);
    scene.add(backCurb);

    const sideCurbGeo = new THREE.BoxGeometry(0.6, 0.25, tankPadDepth);
    const leftCurb = new THREE.Mesh(sideCurbGeo, hazardMat);
    leftCurb.position.set(-tankPadWidth / 2, tankPadHeight + 0.12, -15);
    scene.add(leftCurb);

    const rightCurb = new THREE.Mesh(sideCurbGeo, hazardMat);
    rightCurb.position.set(tankPadWidth / 2, tankPadHeight + 0.12, -15);
    scene.add(rightCurb);

    // Saddle pedestals
    [-16, 16].forEach((tx) => {
      [-5.5, 5.5].forEach((offset) => {
        const plinthGeo = new THREE.BoxGeometry(2.4, 0.6, 8.5);
        const plinthMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
        const plinth = new THREE.Mesh(plinthGeo, plinthMat);
        plinth.position.set(tx + offset, tankPadHeight + 0.3, -15);
        plinth.receiveShadow = true;
        plinth.castShadow = true;
        scene.add(plinth);
      });
    });

    // 7. HIGH-FIDELITY TANKS WITH TRANSPARENCY & INTERNAL LIQUID CORE
    const tankShellMaterials: THREE.MeshStandardMaterial[] = [];
    const decalMaterials: THREE.MeshBasicMaterial[] = [];

    const ssRingMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.15,
    });

    const handrailMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.7,
      roughness: 0.3,
    });

    const pipeSSMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.88,
      roughness: 0.18,
    });

    // Glowing internal DEF Liquid Material
    const internalLiquidMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x0284c7,
      emissiveIntensity: 1.4,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    });

    const createHighDetailTank = (tankNum: number, xPos: number, volume: number) => {
      const tankGroup = new THREE.Group();
      tankGroup.name = `Tank${tankNum}`;

      const radius = 4.2;
      const length = 15.5;
      const tankElev = tankPadHeight + 0.6 + 1.2 + radius;
      const fillPct = volume / TANK_CAPACITY;

      // Shell Material (White glossy when distant, transparent when zoomed in)
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.16,
        metalness: 0.12,
        transparent: true,
        opacity: 1.0,
      });
      tankShellMaterials.push(shellMat);

      // 1. Outer Tank Cylinder Shell
      const bodyGeo = new THREE.CylinderGeometry(radius, radius, length, 48);
      const bodyMesh = new THREE.Mesh(bodyGeo, shellMat);
      bodyMesh.rotation.z = Math.PI / 2;
      bodyMesh.position.set(0, tankElev, 0);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      tankGroup.add(bodyMesh);

      // 2. Dished End Caps
      const domeGeo = new THREE.SphereGeometry(radius, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeLeft = new THREE.Mesh(domeGeo, shellMat);
      domeLeft.rotation.z = -Math.PI / 2;
      domeLeft.position.set(-length / 2, tankElev, 0);
      domeLeft.castShadow = true;
      tankGroup.add(domeLeft);

      const domeRight = new THREE.Mesh(domeGeo, shellMat);
      domeRight.rotation.z = Math.PI / 2;
      domeRight.position.set(length / 2, tankElev, 0);
      domeRight.castShadow = true;
      tankGroup.add(domeRight);

      // 3. INTERNAL 3D LIQUID DEF CORE (Visible when zoomed / transparent)
      const liquidRadius = radius * 0.94;
      const liquidLength = length * 0.95;
      const liquidHeight = Math.max(0.6, liquidRadius * 2 * fillPct);

      // Internal fluid body
      const liquidCoreGeo = new THREE.CylinderGeometry(liquidRadius * 0.98, liquidRadius * 0.98, liquidLength, 36);
      const liquidCore = new THREE.Mesh(liquidCoreGeo, internalLiquidMat);
      liquidCore.rotation.z = Math.PI / 2;
      liquidCore.position.set(0, tankElev - (liquidRadius - liquidHeight / 2), 0);
      liquidCore.scale.set(1, fillPct, 1);
      tankGroup.add(liquidCore);

      // Internal Suction Dip Tube
      const dipTubeGeo = new THREE.CylinderGeometry(0.18, 0.18, radius * 1.8, 16);
      const dipTube = new THREE.Mesh(dipTubeGeo, pipeSSMat);
      dipTube.position.set(2.0, tankElev, 0);
      tankGroup.add(dipTube);

      // Internal Baffle Stiffener Rings
      [-4.0, 4.0].forEach((bx) => {
        const baffleGeo = new THREE.RingGeometry(radius * 0.5, radius * 0.92, 24);
        const baffleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, side: THREE.DoubleSide });
        const baffle = new THREE.Mesh(baffleGeo, baffleMat);
        baffle.rotation.y = Math.PI / 2;
        baffle.position.set(bx, tankElev, 0);
        tankGroup.add(baffle);
      });

      // Internal Radar Laser Level Cone (Translucent green/cyan radar telemetry ray)
      const radarConeGeo = new THREE.ConeGeometry(1.6, radius * 1.7, 16, 1, true);
      const radarConeMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.25,
        wireframe: true,
      });
      const radarCone = new THREE.Mesh(radarConeGeo, radarConeMat);
      radarCone.rotation.x = Math.PI;
      radarCone.position.set(0, tankElev + radius * 0.85 - (radius * 1.7) / 2, 0);
      tankGroup.add(radarCone);

      // 4. Circumferential Steel Stiffener Rings
      [-5.5, -1.8, 1.8, 5.5].forEach((rx) => {
        const ringGeo = new THREE.TorusGeometry(radius + 0.05, 0.08, 16, 48);
        const ringMesh = new THREE.Mesh(ringGeo, ssRingMat);
        ringMesh.rotation.y = Math.PI / 2;
        ringMesh.position.set(rx, tankElev, 0);
        tankGroup.add(ringMesh);
      });

      // 5. Heavy Steel Saddle Supports
      [-5.5, 5.5].forEach((sx) => {
        const saddleGeo = new THREE.BoxGeometry(1.6, 2.4, radius * 2.1);
        const saddleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 });
        const saddle = new THREE.Mesh(saddleGeo, saddleMat);
        saddle.position.set(sx, tankPadHeight + 0.6 + 1.2, 0);
        saddle.castShadow = true;
        tankGroup.add(saddle);
      });

      // 6. Front Decal Plate
      const decalTex = createTankDecalTexture(tankNum, volume, (volume / TANK_CAPACITY) * 100);
      const decalGeo = new THREE.PlaneGeometry(8.2, 4.1);
      const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, opacity: 1.0 });
      decalMaterials.push(decalMat);
      const decalMesh = new THREE.Mesh(decalGeo, decalMat);
      decalMesh.position.set(0, tankElev, radius + 0.08);
      tankGroup.add(decalMesh);

      // 7. Top Catwalk Platform & Handrails
      const catwalkLength = length * 0.92;
      const catwalkWidth = 2.0;
      const catwalkY = tankElev + radius + 0.15;

      const catwalkGeo = new THREE.BoxGeometry(catwalkLength, 0.15, catwalkWidth);
      const catwalkMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 });
      const catwalk = new THREE.Mesh(catwalkGeo, catwalkMat);
      catwalk.position.set(0, catwalkY, 0);
      catwalk.castShadow = true;
      tankGroup.add(catwalk);

      [-catwalkWidth / 2 + 0.05, catwalkWidth / 2 - 0.05].forEach((rz) => {
        const topRailGeo = new THREE.CylinderGeometry(0.04, 0.04, catwalkLength, 12);
        const topRail = new THREE.Mesh(topRailGeo, handrailMat);
        topRail.rotation.z = Math.PI / 2;
        topRail.position.set(0, catwalkY + 1.1, rz);
        tankGroup.add(topRail);

        const midRail = new THREE.Mesh(topRailGeo, handrailMat);
        midRail.rotation.z = Math.PI / 2;
        midRail.position.set(0, catwalkY + 0.55, rz);
        tankGroup.add(midRail);

        for (let st = -catwalkLength / 2; st <= catwalkLength / 2; st += 1.8) {
          const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 12);
          const post = new THREE.Mesh(postGeo, handrailMat);
          post.position.set(st, catwalkY + 0.55, rz);
          tankGroup.add(post);
        }
      });

      // 8. Top Manhole & Radar Sensor
      const manholeGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.5, 24);
      const manhole = new THREE.Mesh(manholeGeo, ssRingMat);
      manhole.position.set(0, catwalkY + 0.35, 0);
      tankGroup.add(manhole);

      const sensorGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.8, 16);
      const sensorMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 });
      const sensor = new THREE.Mesh(sensorGeo, sensorMat);
      sensor.position.set(3.2, catwalkY + 0.5, 0);
      tankGroup.add(sensor);

      const sensorLedGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const sensorLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const sensorLed = new THREE.Mesh(sensorLedGeo, sensorLedMat);
      sensorLed.position.set(3.2, catwalkY + 0.95, 0);
      tankGroup.add(sensorLed);

      // 9. Vertical Glowing Level Sight Glass
      const sightHeight = 6.2;
      const frameGeo = new THREE.BoxGeometry(0.5, sightHeight + 0.4, 0.4);
      const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a }));
      frame.position.set(length / 2 - 1.2, tankElev, radius + 0.2);
      tankGroup.add(frame);

      const sightLiquidMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00b4d8,
        emissiveIntensity: 2.0,
        roughness: 0.1,
      });
      const sightLiquidGeo = new THREE.CylinderGeometry(0.16, 0.16, Math.max(0.4, sightHeight * fillPct), 16);
      const sightLiquid = new THREE.Mesh(sightLiquidGeo, sightLiquidMat);
      sightLiquid.position.set(length / 2 - 1.2, tankElev - (sightHeight - Math.max(0.4, sightHeight * fillPct)) / 2, radius + 0.22);
      tankGroup.add(sightLiquid);

      // 10. Floating Badge (Positioned high to prevent overlap)
      const badgeSprite = createFloatingBadgeSprite(
        `TANK 0${tankNum} • 30,000 L`,
        `${volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} L (${((volume / TANK_CAPACITY) * 100).toFixed(1)}%)`,
        "🛢️",
        "#38bdf8"
      );
      badgeSprite.position.set(0, catwalkY + 4.8, 0);
      badgeSprite.visible = showBadges;
      tankGroup.add(badgeSprite);

      tankGroup.position.set(xPos, 0, -15);
      scene.add(tankGroup);

      return tankGroup;
    };

    createHighDetailTank(1, -16, tank1Volume);
    createHighDetailTank(2, 16, tank2Volume);

    // 7B. INTER-TANK ACCESS WALKWAY BRIDGE & INDUSTRIAL SAFETY CAGED LADDER
    const interTankAccessGroup = new THREE.Group();
    interTankAccessGroup.name = "InterTankAccess";

    const bridgeY = 9.75; // Elevation matching top tank catwalks
    const bridgeZ = -15.0; // Alignment with tank centerline
    const bridgeLength = 17.0; // Distance between Tank 1 and Tank 2 inner ends (-8.5 to +8.5)
    const bridgeWidth = 1.8;

    // 1. Inter-Tank Catwalk Floor (Heavy Industrial Grating)
    const bridgeFloorGeo = new THREE.BoxGeometry(bridgeLength, 0.15, bridgeWidth);
    const bridgeFloorMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.35,
    });
    const bridgeFloor = new THREE.Mesh(bridgeFloorGeo, bridgeFloorMat);
    bridgeFloor.position.set(0, bridgeY, bridgeZ);
    bridgeFloor.castShadow = true;
    bridgeFloor.receiveShadow = true;
    interTankAccessGroup.add(bridgeFloor);

    // Yellow Safety Toe-Boards (Kickplates) along both edges
    [-bridgeWidth / 2 + 0.05, bridgeWidth / 2 - 0.05].forEach((kz) => {
      const kickGeo = new THREE.BoxGeometry(bridgeLength, 0.16, 0.04);
      const kickMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.5 });
      const kick = new THREE.Mesh(kickGeo, kickMat);
      kick.position.set(0, bridgeY + 0.08, bridgeZ + kz);
      interTankAccessGroup.add(kick);
    });

    // 2. Handrails on Walkway Bridge
    // South side handrail (continuous across entire 17m length)
    const bridgeRailMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6, roughness: 0.3 });
    const sTopRailGeo = new THREE.CylinderGeometry(0.04, 0.04, bridgeLength, 12);
    const sTopRail = new THREE.Mesh(sTopRailGeo, bridgeRailMat);
    sTopRail.rotation.z = Math.PI / 2;
    sTopRail.position.set(0, bridgeY + 1.1, bridgeZ + bridgeWidth / 2 - 0.05);
    interTankAccessGroup.add(sTopRail);

    const sMidRail = new THREE.Mesh(sTopRailGeo, bridgeRailMat);
    sMidRail.rotation.z = Math.PI / 2;
    sMidRail.position.set(0, bridgeY + 0.55, bridgeZ + bridgeWidth / 2 - 0.05);
    interTankAccessGroup.add(sMidRail);

    for (let st = -bridgeLength / 2; st <= bridgeLength / 2; st += 1.7) {
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 12);
      const post = new THREE.Mesh(postGeo, bridgeRailMat);
      post.position.set(st, bridgeY + 0.55, bridgeZ + bridgeWidth / 2 - 0.05);
      interTankAccessGroup.add(post);
    }

    // North side handrails (with 1.2m opening at x in [-3.4, -2.2] for the ladder entry)
    const ladderEntryXMin = -3.4;
    const ladderEntryXMax = -2.2;
    const nSideZ = bridgeZ - bridgeWidth / 2 + 0.05;

    // Segment A (West of ladder: x = -8.5 to -3.4)
    const lenA = Math.abs(ladderEntryXMin - (-bridgeLength / 2));
    const centerA = (-bridgeLength / 2 + ladderEntryXMin) / 2;
    const nTopA = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, lenA, 12), bridgeRailMat);
    nTopA.rotation.z = Math.PI / 2;
    nTopA.position.set(centerA, bridgeY + 1.1, nSideZ);
    interTankAccessGroup.add(nTopA);

    const nMidA = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, lenA, 12), bridgeRailMat);
    nMidA.rotation.z = Math.PI / 2;
    nMidA.position.set(centerA, bridgeY + 0.55, nSideZ);
    interTankAccessGroup.add(nMidA);

    for (let st = -bridgeLength / 2; st <= ladderEntryXMin + 0.1; st += 1.7) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 12), bridgeRailMat);
      post.position.set(st, bridgeY + 0.55, nSideZ);
      interTankAccessGroup.add(post);
    }

    // Segment B (East of ladder: x = -2.2 to +8.5)
    const lenB = Math.abs(bridgeLength / 2 - ladderEntryXMax);
    const centerB = (ladderEntryXMax + bridgeLength / 2) / 2;
    const nTopB = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, lenB, 12), bridgeRailMat);
    nTopB.rotation.z = Math.PI / 2;
    nTopB.position.set(centerB, bridgeY + 1.1, nSideZ);
    interTankAccessGroup.add(nTopB);

    const nMidB = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, lenB, 12), bridgeRailMat);
    nMidB.rotation.z = Math.PI / 2;
    nMidB.position.set(centerB, bridgeY + 0.55, nSideZ);
    interTankAccessGroup.add(nMidB);

    for (let st = ladderEntryXMax; st <= bridgeLength / 2; st += 1.7) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 12), bridgeRailMat);
      post.position.set(st, bridgeY + 0.55, nSideZ);
      interTankAccessGroup.add(post);
    }

    // Yellow Self-Closing Safety Swing Gate at ladder entry
    const gateGeo = new THREE.BoxGeometry(1.0, 0.8, 0.05);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6 });
    const gate = new THREE.Mesh(gateGeo, gateMat);
    gate.position.set(-2.8, bridgeY + 0.65, nSideZ);
    interTankAccessGroup.add(gate);

    // 3. Structural Steel Support Towers under Bridge (Pillars at x = -5.0 and +5.0)
    [-5.0, 5.0].forEach((cx) => {
      const colHeight = bridgeY - 0.4;
      const colGeo = new THREE.CylinderGeometry(0.18, 0.18, colHeight, 16);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(cx, 0.4 + colHeight / 2, bridgeZ);
      col.castShadow = true;
      interTankAccessGroup.add(col);

      // Heavy anchor baseplate on plinth
      const bGeo = new THREE.BoxGeometry(0.8, 0.25, 0.8);
      const bMesh = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
      bMesh.position.set(cx, 0.4 + 0.12, bridgeZ);
      interTankAccessGroup.add(bMesh);

      // Diagonal brace back to bridge underside
      const braceGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 12);
      const brace = new THREE.Mesh(braceGeo, colMat);
      brace.rotation.z = cx < 0 ? -Math.PI / 4 : Math.PI / 4;
      brace.position.set(cx + (cx < 0 ? 1.0 : -1.0), bridgeY - 1.2, bridgeZ);
      interTankAccessGroup.add(brace);
    });

    // 4. INDUSTRIAL SAFETY CAGED LADDER (x = -2.8, climbing to bridge at bridgeY = 9.75)
    const ladderX = -2.8;
    const ladderZ = bridgeZ - bridgeWidth / 2 - 0.15; // At z = -16.05
    const ladderBottomY = 0.4;
    const ladderHeight = bridgeY - ladderBottomY; // 9.35m
    const ladderRailSpread = 0.7; // 0.7m rung width

    // Vertical Stringers (Rails)
    [-ladderRailSpread / 2, ladderRailSpread / 2].forEach((rx) => {
      // Main vertical rail
      const railGeo = new THREE.CylinderGeometry(0.04, 0.04, ladderHeight + 1.2, 12);
      const railMesh = new THREE.Mesh(railGeo, pipeSSMat);
      railMesh.position.set(ladderX + rx, ladderBottomY + (ladderHeight + 1.2) / 2, ladderZ);
      railMesh.castShadow = true;
      interTankAccessGroup.add(railMesh);

      // Top walk-through grab handle curving smoothly into the bridge floor
      const loopCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(ladderX + rx, bridgeY + 1.1, ladderZ),
        new THREE.Vector3(ladderX + rx, bridgeY + 1.2, ladderZ + 0.35),
        new THREE.Vector3(ladderX + rx, bridgeY + 0.1, ladderZ + 0.35)
      );
      const loopGeo = new THREE.TubeGeometry(loopCurve, 12, 0.035, 8, false);
      const loopMesh = new THREE.Mesh(loopGeo, bridgeRailMat);
      interTankAccessGroup.add(loopMesh);

      // Base anchor plate on concrete
      const plateGeo = new THREE.BoxGeometry(0.3, 0.1, 0.3);
      const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
      plate.position.set(ladderX + rx, ladderBottomY + 0.05, ladderZ);
      interTankAccessGroup.add(plate);
    });

    // Non-slip Ladder Rungs (every 0.35m)
    const rungGeo = new THREE.CylinderGeometry(0.025, 0.025, ladderRailSpread, 12);
    for (let ry = ladderBottomY + 0.35; ry <= bridgeY; ry += 0.35) {
      const rung = new THREE.Mesh(rungGeo, ssRingMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(ladderX, ry, ladderZ);
      interTankAccessGroup.add(rung);
    }

    // 5. OSHA-STANDARD SAFETY CAGE (HOOPS & VERTICAL STRAPS)
    const cageStartY = 2.4; // Starts 2.0m above ground (standard clearance)
    const cageRadius = 0.48; // Generous 0.96m diameter safety cage
    const cageCenterZ = ladderZ - cageRadius + 0.12;

    // Safety Hoops every 0.75m
    for (let hy = cageStartY; hy <= bridgeY; hy += 0.75) {
      const isBottomHoop = hy === cageStartY;
      const rad = isBottomHoop ? cageRadius * 1.25 : cageRadius; // Flared bell at entrance
      const hoopCurve = new THREE.EllipseCurve(
        0, 0,
        rad, rad,
        -Math.PI * 0.75, Math.PI * 0.75,
        false,
        0
      );
      const hoopPoints = hoopCurve.getPoints(24).map((p) => new THREE.Vector3(p.x, 0, p.y));
      const hoopPath = new THREE.CatmullRomCurve3(hoopPoints);
      const hoopTubeGeo = new THREE.TubeGeometry(hoopPath, 20, 0.025, 8, false);
      const hoopMesh = new THREE.Mesh(hoopTubeGeo, bridgeRailMat);
      hoopMesh.position.set(ladderX, hy, cageCenterZ);
      interTankAccessGroup.add(hoopMesh);
    }

    // 5 Vertical Safety Straps around cage perimeter
    [-Math.PI * 0.6, -Math.PI * 0.3, 0, Math.PI * 0.3, Math.PI * 0.6].forEach((angle) => {
      const sx = ladderX + Math.sin(angle) * cageRadius;
      const sz = cageCenterZ + Math.cos(angle) * cageRadius;
      const strapHeight = bridgeY - cageStartY;
      const strapGeo = new THREE.BoxGeometry(0.04, strapHeight, 0.015);
      const strap = new THREE.Mesh(strapGeo, bridgeRailMat);
      strap.position.set(sx, cageStartY + strapHeight / 2, sz);
      interTankAccessGroup.add(strap);
    });

    // 6. Sturdy Ladder Standoff Brackets (anchored back to tank yard foundation & bridge)
    [2.2, 5.5, 8.5].forEach((by) => {
      const bracketGeo = new THREE.BoxGeometry(ladderRailSpread + 0.3, 0.08, 0.45);
      const bracket = new THREE.Mesh(bracketGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      bracket.position.set(ladderX, by, ladderZ + 0.2);
      interTankAccessGroup.add(bracket);
    });

    // 7. Floating 3D Badge for Ladder Access
    const ladderBadge = createFloatingBadgeSprite(
      "TANK ACCESS LADDER",
      "SAFETY CAGED • CATWALK EL. 9.8m",
      "🪜",
      "#eab308"
    );
    ladderBadge.position.set(ladderX, bridgeY + 3.2, bridgeZ);
    ladderBadge.visible = showBadges;
    interTankAccessGroup.add(ladderBadge);

    scene.add(interTankAccessGroup);

    // 8. DOWNSIDE (BOTTOM) EQUALIZING PIPELINE & SUCTION NETWORK
    const manifoldGroup = new THREE.Group();
    manifoldGroup.name = "Manifold";

    const downsideY = 1.8; // Low-level downside connection elevation

    // --- A. DOWNSIDE CROSSOVER HEADER (Between Tank 1 and Tank 2 at lower elevation) ---
    // Horizontal downside pipe running along X from x = -8.5 to x = 8.5 at y = 1.8, z = -15
    const crossPipeLength = 17.0;
    const crossPipeGeo = new THREE.CylinderGeometry(0.38, 0.38, crossPipeLength, 24);
    const crossPipe = new THREE.Mesh(crossPipeGeo, pipeSSMat);
    crossPipe.rotation.z = Math.PI / 2;
    crossPipe.position.set(0, downsideY, -15);
    crossPipe.castShadow = true;
    manifoldGroup.add(crossPipe);

    // Glowing Flow Inspection Glass on Downside Crossover
    const flowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00d2ff,
      emissiveIntensity: 1.4,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    const flowGlassGeo = new THREE.CylinderGeometry(0.42, 0.42, 4.5, 20);
    const flowGlass = new THREE.Mesh(flowGlassGeo, flowGlassMat);
    flowGlass.rotation.z = Math.PI / 2;
    flowGlass.position.set(0, downsideY, -15);
    manifoldGroup.add(flowGlass);

    // Downside Tank Connection Nozzles on Tank 1 & Tank 2 (Lower Inner Heads)
    [-8.5, 8.5].forEach((tx) => {
      // Tank discharge stub pipe connecting into tank shell at y = 2.4 down to y = 1.8
      const stubGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16);
      const stub = new THREE.Mesh(stubGeo, pipeSSMat);
      stub.position.set(tx, downsideY + 0.4, -15);
      manifoldGroup.add(stub);

      // Flange at junction
      const flangeGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 16);
      const flange = new THREE.Mesh(flangeGeo, ssRingMat);
      flange.position.set(tx, downsideY + 0.1, -15);
      manifoldGroup.add(flange);

      // Isolation Valve with Yellow Handle at downside
      const valveBoxGeo = new THREE.BoxGeometry(0.65, 0.65, 0.65);
      const vBox = new THREE.Mesh(valveBoxGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      vBox.position.set(tx, downsideY, -15);
      manifoldGroup.add(vBox);

      const leverGeo = new THREE.BoxGeometry(0.08, 0.45, 0.12);
      const lever = new THREE.Mesh(leverGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
      lever.position.set(tx, downsideY + 0.35, -15);
      manifoldGroup.add(lever);
    });

    // Central Motorized Balancing Valve Actuator at Downside Crossover
    const valveBodyGeo = new THREE.SphereGeometry(0.85, 20, 20);
    const valveMat = new THREE.MeshStandardMaterial({
      color: manifoldBalanced ? 0x10b981 : 0xef4444,
      emissive: manifoldBalanced ? 0x059669 : 0xb91c1c,
      emissiveIntensity: 0.8,
    });
    const valveBody = new THREE.Mesh(valveBodyGeo, valveMat);
    valveBody.position.set(0, downsideY, -15);
    manifoldGroup.add(valveBody);

    const actuatorBoxGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const actuatorBox = new THREE.Mesh(actuatorBoxGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 }));
    actuatorBox.position.set(0, downsideY + 1.1, -15);
    actuatorBox.castShadow = true;
    manifoldGroup.add(actuatorBox);

    // Floating Badge for Downside Manifold
    const manifoldSprite = createFloatingBadgeSprite(
      "EQUALIZED CROSSOVER MANIFOLD",
      "STATUS: BALANCED • INTERCONNECTED",
      "⚖️",
      "#10b981"
    );
    manifoldSprite.position.set(0, downsideY + 3.6, -15);
    manifoldSprite.visible = showBadges;
    manifoldGroup.add(manifoldSprite);

    // --- B. LOW-LEVEL SUCTION PIPELINE (FROM DOWNSIDE CROSSOVER AT z = -15 TO PUMPS AT z = -3.0) ---
    // Horizontal run along Z at x = 0, y = 1.8
    const suctionLength = 12.0; // from z = -15 to z = -3.0
    const suctionPipeGeo = new THREE.CylinderGeometry(0.38, 0.38, suctionLength, 20);
    const suctionPipe = new THREE.Mesh(suctionPipeGeo, pipeSSMat);
    suctionPipe.rotation.x = Math.PI / 2;
    suctionPipe.position.set(0, downsideY, -9.0);
    suctionPipe.castShadow = true;
    manifoldGroup.add(suctionPipe);

    // Flow core in suction pipe
    const suctionFlowGeo = new THREE.CylinderGeometry(0.41, 0.41, suctionLength * 0.98, 16);
    const suctionFlow = new THREE.Mesh(suctionFlowGeo, flowGlassMat);
    suctionFlow.rotation.x = Math.PI / 2;
    suctionFlow.position.set(0, downsideY, -9.0);
    manifoldGroup.add(suctionFlow);

    // Sturdy Low-Profile Pipe Supports with Safety Yellow Bases along Suction Run
    [-13.0, -9.0, -5.0].forEach((pz) => {
      const standGeo = new THREE.CylinderGeometry(0.08, 0.08, downsideY, 12);
      const stand = new THREE.Mesh(standGeo, ssRingMat);
      stand.position.set(0, downsideY / 2, pz);
      stand.castShadow = true;
      manifoldGroup.add(stand);

      const standBaseGeo = new THREE.BoxGeometry(0.8, 0.25, 0.8);
      const standBase = new THREE.Mesh(standBaseGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
      standBase.position.set(0, 0.125, pz);
      manifoldGroup.add(standBase);
    });

    // --- C. CENTRAL DUAL BOOSTER PUMP SKID ---
    const skidGeo = new THREE.BoxGeometry(8, 0.8, 5.5);
    const skidMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const pumpSkid = new THREE.Mesh(skidGeo, skidMat);
    pumpSkid.position.set(0, 0.4, -3.0);
    pumpSkid.receiveShadow = true;
    pumpSkid.castShadow = true;
    manifoldGroup.add(pumpSkid);

    // Suction Tee Header at y = 1.8: splits left and right to pumps
    const suctionTeeGeo = new THREE.CylinderGeometry(0.32, 0.32, 3.6, 16);
    const suctionTee = new THREE.Mesh(suctionTeeGeo, pipeSSMat);
    suctionTee.rotation.z = Math.PI / 2;
    suctionTee.position.set(0, downsideY, -3.0);
    manifoldGroup.add(suctionTee);

    // 2 Vertical Multistage Stainless Booster Pumps (Blue Motors at x = -1.6 and x = 1.6)
    [-1.6, 1.6].forEach((px) => {
      // Pump Drive Motor
      const motorGeo = new THREE.CylinderGeometry(0.65, 0.65, 2.4, 20);
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.3 });
      const motor = new THREE.Mesh(motorGeo, motorMat);
      motor.position.set(px, 2.0, -3.0);
      motor.castShadow = true;
      manifoldGroup.add(motor);

      // Stainless Pump Base
      const baseGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.0, 16);
      const pBase = new THREE.Mesh(baseGeo, pipeSSMat);
      pBase.position.set(px, 0.9, -3.0);
      manifoldGroup.add(pBase);

      // Discharge pipe curving forward from pump to common discharge manifold
      const pDischGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.2, 12);
      const pDisch = new THREE.Mesh(pDischGeo, pipeSSMat);
      pDisch.rotation.x = Math.PI / 2;
      pDisch.position.set(px, 1.8, -2.4);
      manifoldGroup.add(pDisch);
    });

    // Common Discharge Manifold Header across pumps at y = 1.8, z = -1.8
    const dischManifoldGeo = new THREE.CylinderGeometry(0.32, 0.32, 3.6, 16);
    const dischManifold = new THREE.Mesh(dischManifoldGeo, pipeSSMat);
    dischManifold.rotation.z = Math.PI / 2;
    dischManifold.position.set(0, 1.8, -1.8);
    manifoldGroup.add(dischManifold);

    // Pressure Gauge on Discharge Manifold
    const gaugeDialGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 16);
    const gaugeDialMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const gaugeDial = new THREE.Mesh(gaugeDialGeo, gaugeDialMat);
    gaugeDial.rotation.x = Math.PI / 2;
    gaugeDial.position.set(0, 2.3, -1.8);
    manifoldGroup.add(gaugeDial);

    // PLC Cabinet placed SAFELY to the side at x = 3.6
    const plcBoxGeo = new THREE.BoxGeometry(1.4, 2.2, 0.9);
    const plcBox = new THREE.Mesh(plcBoxGeo, new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3 }));
    plcBox.position.set(3.6, 1.5, -3.0);
    plcBox.castShadow = true;
    manifoldGroup.add(plcBox);

    // --- E. MAIN DISTRIBUTION SUPPLY PIPELINE (FROM PUMPS AT z = -1.8 TO FORECOURT AT z = 11.8) ---
    // Straight horizontal 6-inch pipe running along Z at x = 0, y = 1.6
    const mainPipeLength = 13.6; // from z = -1.8 to z = 11.8
    const mainSupplyPipeGeo = new THREE.CylinderGeometry(0.32, 0.32, mainPipeLength, 20);
    const mainSupplyPipe = new THREE.Mesh(mainSupplyPipeGeo, pipeSSMat);
    mainSupplyPipe.rotation.x = Math.PI / 2;
    mainSupplyPipe.position.set(0, 1.6, 5.0);
    mainSupplyPipe.castShadow = true;
    manifoldGroup.add(mainSupplyPipe);

    // Glowing fluid core in main supply line
    const mainFlowCoreGeo = new THREE.CylinderGeometry(0.35, 0.35, mainPipeLength * 0.98, 16);
    const mainFlowCore = new THREE.Mesh(mainFlowCoreGeo, flowGlassMat);
    mainFlowCore.rotation.x = Math.PI / 2;
    mainFlowCore.position.set(0, 1.6, 5.0);
    manifoldGroup.add(mainFlowCore);

    // Pipe Support Stands with Yellow Bases along Main Supply Line
    [-0.5, 3.5, 7.5, 10.5].forEach((pz) => {
      const standGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 12);
      const stand = new THREE.Mesh(standGeo, ssRingMat);
      stand.position.set(0, 0.8, pz);
      stand.castShadow = true;
      manifoldGroup.add(stand);

      const standBaseGeo = new THREE.BoxGeometry(0.8, 0.25, 0.8);
      const standBase = new THREE.Mesh(standBaseGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
      standBase.position.set(0, 0.125, pz);
      manifoldGroup.add(standBase);
    });

    // --- F. FORECOURT SUPPLY DISTRIBUTION HEADER (ACROSS ALL 10 DISPENSERS) ---
    // Horizontal header running along X from x = -31 to x = 31 at y = 1.6, z = 11.8
    const headerSpan = 62.0;
    const forecourtHeaderGeo = new THREE.CylinderGeometry(0.30, 0.30, headerSpan, 24);
    const forecourtHeader = new THREE.Mesh(forecourtHeaderGeo, pipeSSMat);
    forecourtHeader.rotation.z = Math.PI / 2;
    forecourtHeader.position.set(0, 1.6, 11.8);
    forecourtHeader.castShadow = true;
    manifoldGroup.add(forecourtHeader);

    // Glowing Flow Core in Forecourt Header
    const headerFlowCoreGeo = new THREE.CylinderGeometry(0.33, 0.33, headerSpan * 0.98, 20);
    const headerFlowCore = new THREE.Mesh(headerFlowCoreGeo, flowGlassMat);
    headerFlowCore.rotation.z = Math.PI / 2;
    headerFlowCore.position.set(0, 1.6, 11.8);
    manifoldGroup.add(headerFlowCore);

    // T-junction at center (0, 1.6, 11.8)
    const tJunctionGeo = new THREE.SphereGeometry(0.42, 16, 16);
    const tJunction = new THREE.Mesh(tJunctionGeo, pipeSSMat);
    tJunction.position.set(0, 1.6, 11.8);
    manifoldGroup.add(tJunction);

    scene.add(manifoldGroup);

    // 9. DUAL SEPARATE BULK REFILL PIPELINES & WEST OFFLOAD METERING SKID (SIDE-BY-SIDE LANES)
    const refillGroup = new THREE.Group();
    refillGroup.name = "RefillNetwork";

    const refillGroundY = 1.8;
    const refillUpsideY = 11.5; // Top / upside elevation above tank shells
    const riserHeight = refillUpsideY - refillGroundY;

    // Line 1 (Dedicated for Tank 1): West Track at x = -28.2
    // Line 2 (Dedicated for Tank 2): East Track at x = -25.2
    const xLine1 = -28.2;
    const xLine2 = -25.2;

    // --- A. EXPANDED CONCRETE OFFLOAD PLINTH (ACCOMMODATES DUAL PARALLEL SKIDS) ---
    const plinthGeo = new THREE.BoxGeometry(5.4, 0.5, 8.0);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.set(-26.7, 0.25, -13.8);
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    refillGroup.add(plinth);

    const pCurbGeo = new THREE.BoxGeometry(5.6, 0.2, 8.2);
    const pCurb = new THREE.Mesh(pCurbGeo, hazardMat);
    pCurb.position.set(-26.7, 0.4, -13.8);
    refillGroup.add(pCurb);

    // Helper: Create an industrial station identification plaque
    const createLineSign = (text: string) => {
      const cv = document.createElement("canvas");
      cv.width = 384;
      cv.height = 96;
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, 384, 96);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 376, 88);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(text, 192, 58);
      }
      const tex = new THREE.CanvasTexture(cv);
      const signGeo = new THREE.PlaneGeometry(1.6, 0.42);
      const signMat = new THREE.MeshBasicMaterial({ map: tex });
      return new THREE.Mesh(signGeo, signMat);
    };

    // --- B. LINE 1: DEDICATED OFFLOAD LANE FOR TANK 1 (x = -28.2) ---
    // 1. Line 1 Camlock Intake Coupling (z = -10.5)
    const hose1Geo = new THREE.CylinderGeometry(0.32, 0.35, 0.5, 16);
    const hose1 = new THREE.Mesh(hose1Geo, new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7 }));
    hose1.rotation.x = Math.PI / 2;
    hose1.position.set(xLine1, refillGroundY, -10.5);
    refillGroup.add(hose1);

    const cap1Geo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16);
    const cap1 = new THREE.Mesh(cap1Geo, new THREE.MeshStandardMaterial({ color: 0xb45309 }));
    cap1.rotation.x = Math.PI / 2;
    cap1.position.set(xLine1, refillGroundY, -10.25);
    refillGroup.add(cap1);

    const sign1 = createLineSign("LINE 1: TANK 01");
    sign1.position.set(xLine1, refillGroundY + 1.6, -10.5);
    refillGroup.add(sign1);

    // Support Stand for Camlock 1
    const leg1Geo = new THREE.CylinderGeometry(0.06, 0.06, refillGroundY, 8);
    const leg1 = new THREE.Mesh(leg1Geo, ssRingMat);
    leg1.position.set(xLine1, refillGroundY / 2, -10.5);
    refillGroup.add(leg1);

    // Spool before Flowmeter 1
    const spoolIn1Geo = new THREE.CylinderGeometry(0.26, 0.26, 0.8, 16);
    const spoolIn1 = new THREE.Mesh(spoolIn1Geo, pipeSSMat);
    spoolIn1.rotation.x = Math.PI / 2;
    spoolIn1.position.set(xLine1, refillGroundY, -11.2);
    refillGroup.add(spoolIn1);

    // 2. Line 1 Digital Flowmeter (z = -12.2)
    const spool1Geo = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 20);
    const spool1Mat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const spool1 = new THREE.Mesh(spool1Geo, spool1Mat);
    spool1.rotation.x = Math.PI / 2;
    spool1.position.set(xLine1, refillGroundY, -12.2);
    refillGroup.add(spool1);

    [-0.6, 0.6].forEach((fz) => {
      const flGeo = new THREE.CylinderGeometry(0.50, 0.50, 0.1, 16);
      const fl = new THREE.Mesh(flGeo, ssRingMat);
      fl.rotation.x = Math.PI / 2;
      fl.position.set(xLine1, refillGroundY, -12.2 + fz);
      refillGroup.add(fl);
    });

    const stem1Geo = new THREE.CylinderGeometry(0.10, 0.10, 0.5, 12);
    const stem1 = new THREE.Mesh(stem1Geo, ssRingMat);
    stem1.position.set(xLine1, refillGroundY + 0.55, -12.2);
    refillGroup.add(stem1);

    const head1BoxGeo = new THREE.BoxGeometry(0.75, 0.65, 0.55);
    const head1Box = new THREE.Mesh(head1BoxGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 }));
    head1Box.position.set(xLine1, refillGroundY + 1.05, -12.2);
    refillGroup.add(head1Box);

    const lcd1Geo = new THREE.PlaneGeometry(0.60, 0.40);
    const lcd1Mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const lcd1 = new THREE.Mesh(lcd1Geo, lcd1Mat);
    lcd1.position.set(xLine1, refillGroundY + 1.05, -12.2 + 0.28);
    refillGroup.add(lcd1);

    // Spool between Flowmeter 1 & Valve 1
    const spoolMid1Geo = new THREE.CylinderGeometry(0.26, 0.26, 0.6, 16);
    const spoolMid1 = new THREE.Mesh(spoolMid1Geo, pipeSSMat);
    spoolMid1.rotation.x = Math.PI / 2;
    spoolMid1.position.set(xLine1, refillGroundY, -13.1);
    refillGroup.add(spoolMid1);

    // 3. Line 1 Motorized Valve (z = -14.0)
    const v1Geo = new THREE.SphereGeometry(0.48, 16, 16);
    const v1Body = new THREE.Mesh(v1Geo, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
    v1Body.position.set(xLine1, refillGroundY, -14.0);
    refillGroup.add(v1Body);

    const act1Geo = new THREE.BoxGeometry(0.75, 0.75, 0.75);
    const act1 = new THREE.Mesh(act1Geo, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }));
    act1.position.set(xLine1, refillGroundY + 0.7, -14.0);
    refillGroup.add(act1);

    const v1LedGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const v1LedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 });
    refillValve1LedRef.current = v1LedMat;
    const v1Led = new THREE.Mesh(v1LedGeo, v1LedMat);
    v1Led.position.set(xLine1, refillGroundY + 1.15, -14.0);
    refillGroup.add(v1Led);

    // Feeder pipe to base of Riser 1 at z = -17.2
    const feed1Geo = new THREE.CylinderGeometry(0.26, 0.26, 2.7, 16);
    const feed1 = new THREE.Mesh(feed1Geo, pipeSSMat);
    feed1.rotation.x = Math.PI / 2;
    feed1.position.set(xLine1, refillGroundY, -15.6);
    feed1.castShadow = true;
    refillGroup.add(feed1);

    // 4. Line 1 Vertical Riser (x = -28.2, z = -17.2)
    const riser1Geo = new THREE.CylinderGeometry(0.28, 0.28, riserHeight, 16);
    const riser1 = new THREE.Mesh(riser1Geo, pipeSSMat);
    riser1.position.set(xLine1, (refillGroundY + refillUpsideY) / 2, -17.2);
    riser1.castShadow = true;
    refillGroup.add(riser1);

    const riser1GlassGeo = new THREE.CylinderGeometry(0.31, 0.31, riserHeight * 0.98, 16);
    const riser1Glass = new THREE.Mesh(riser1GlassGeo, flowGlassMat);
    riser1Glass.position.set(xLine1, (refillGroundY + refillUpsideY) / 2, -17.2);
    refillGroup.add(riser1Glass);

    // 5. Line 1 Upside Horizontal Pipe (Runs from x = -28.2 to Tank 1 top at x = -16.0)
    const pipe1Len = 12.2; // from -28.2 to -16.0
    const pipe1Geo = new THREE.CylinderGeometry(0.28, 0.28, pipe1Len, 16);
    const pipe1 = new THREE.Mesh(pipe1Geo, pipeSSMat);
    pipe1.rotation.z = Math.PI / 2;
    pipe1.position.set(xLine1 + pipe1Len / 2, refillUpsideY, -17.2);
    pipe1.castShadow = true;
    refillGroup.add(pipe1);

    const pipe1GlassGeo = new THREE.CylinderGeometry(0.31, 0.31, pipe1Len * 0.98, 16);
    const pipe1Glass = new THREE.Mesh(pipe1GlassGeo, flowGlassMat);
    pipe1Glass.rotation.z = Math.PI / 2;
    pipe1Glass.position.set(xLine1 + pipe1Len / 2, refillUpsideY, -17.2);
    refillGroup.add(pipe1Glass);

    // 6. Line 1 Top Inlet Drop into Tank 1 (x = -16.0)
    const topBranch1Geo = new THREE.CylinderGeometry(0.26, 0.26, 2.2, 16);
    const topBranch1 = new THREE.Mesh(topBranch1Geo, pipeSSMat);
    topBranch1.rotation.x = Math.PI / 2;
    topBranch1.position.set(-16.0, refillUpsideY, -16.1);
    topBranch1.castShadow = true;
    refillGroup.add(topBranch1);

    const drop1Geo = new THREE.CylinderGeometry(0.26, 0.26, 0.8, 16);
    const drop1 = new THREE.Mesh(drop1Geo, pipeSSMat);
    drop1.position.set(-16.0, refillUpsideY - 0.4, -15.0);
    refillGroup.add(drop1);

    const fl1Geo = new THREE.CylinderGeometry(0.44, 0.44, 0.12, 16);
    const fl1 = new THREE.Mesh(fl1Geo, ssRingMat);
    fl1.position.set(-16.0, refillUpsideY - 0.75, -15.0);
    refillGroup.add(fl1);

    const check1Geo = new THREE.CylinderGeometry(0.36, 0.36, 0.4, 16);
    const check1 = new THREE.Mesh(check1Geo, new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7 }));
    check1.rotation.x = Math.PI / 2;
    check1.position.set(-16.0, refillUpsideY, -16.5);
    refillGroup.add(check1);

    const v1BoxGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const v1Box = new THREE.Mesh(v1BoxGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    v1Box.position.set(-16.0, refillUpsideY, -15.6);
    refillGroup.add(v1Box);

    const v1HandleGeo = new THREE.BoxGeometry(0.08, 0.42, 0.12);
    const v1Handle = new THREE.Mesh(v1HandleGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
    v1Handle.position.set(-16.0, refillUpsideY + 0.3, -15.6);
    refillGroup.add(v1Handle);


    // --- C. LINE 2: DEDICATED OFFLOAD LANE FOR TANK 2 (x = -25.2, SIDE-BY-SIDE!) ---
    // 1. Line 2 Camlock Intake Coupling (z = -10.5)
    const hose2Geo = new THREE.CylinderGeometry(0.32, 0.35, 0.5, 16);
    const hose2 = new THREE.Mesh(hose2Geo, new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7 }));
    hose2.rotation.x = Math.PI / 2;
    hose2.position.set(xLine2, refillGroundY, -10.5);
    refillGroup.add(hose2);

    const cap2Geo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16);
    const cap2 = new THREE.Mesh(cap2Geo, new THREE.MeshStandardMaterial({ color: 0xb45309 }));
    cap2.rotation.x = Math.PI / 2;
    cap2.position.set(xLine2, refillGroundY, -10.25);
    refillGroup.add(cap2);

    const sign2 = createLineSign("LINE 2: TANK 02");
    sign2.position.set(xLine2, refillGroundY + 1.6, -10.5);
    refillGroup.add(sign2);

    // Support Stand for Camlock 2
    const leg2Geo = new THREE.CylinderGeometry(0.06, 0.06, refillGroundY, 8);
    const leg2 = new THREE.Mesh(leg2Geo, ssRingMat);
    leg2.position.set(xLine2, refillGroundY / 2, -10.5);
    refillGroup.add(leg2);

    // Spool before Flowmeter 2
    const spoolIn2Geo = new THREE.CylinderGeometry(0.26, 0.26, 0.8, 16);
    const spoolIn2 = new THREE.Mesh(spoolIn2Geo, pipeSSMat);
    spoolIn2.rotation.x = Math.PI / 2;
    spoolIn2.position.set(xLine2, refillGroundY, -11.2);
    refillGroup.add(spoolIn2);

    // 2. Line 2 Digital Flowmeter (z = -12.2)
    const spool2Geo = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 20);
    const spool2 = new THREE.Mesh(spool2Geo, spool1Mat);
    spool2.rotation.x = Math.PI / 2;
    spool2.position.set(xLine2, refillGroundY, -12.2);
    refillGroup.add(spool2);

    [-0.6, 0.6].forEach((fz) => {
      const flGeo = new THREE.CylinderGeometry(0.50, 0.50, 0.1, 16);
      const fl = new THREE.Mesh(flGeo, ssRingMat);
      fl.rotation.x = Math.PI / 2;
      fl.position.set(xLine2, refillGroundY, -12.2 + fz);
      refillGroup.add(fl);
    });

    const stem2Geo = new THREE.CylinderGeometry(0.10, 0.10, 0.5, 12);
    const stem2 = new THREE.Mesh(stem2Geo, ssRingMat);
    stem2.position.set(xLine2, refillGroundY + 0.55, -12.2);
    refillGroup.add(stem2);

    const head2BoxGeo = new THREE.BoxGeometry(0.75, 0.65, 0.55);
    const head2Box = new THREE.Mesh(head2BoxGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 }));
    head2Box.position.set(xLine2, refillGroundY + 1.05, -12.2);
    refillGroup.add(head2Box);

    const lcd2Geo = new THREE.PlaneGeometry(0.60, 0.40);
    const lcd2Mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const lcd2 = new THREE.Mesh(lcd2Geo, lcd2Mat);
    lcd2.position.set(xLine2, refillGroundY + 1.05, -12.2 + 0.28);
    refillGroup.add(lcd2);

    // Spool between Flowmeter 2 & Valve 2
    const spoolMid2Geo = new THREE.CylinderGeometry(0.26, 0.26, 0.6, 16);
    const spoolMid2 = new THREE.Mesh(spoolMid2Geo, pipeSSMat);
    spoolMid2.rotation.x = Math.PI / 2;
    spoolMid2.position.set(xLine2, refillGroundY, -13.1);
    refillGroup.add(spoolMid2);

    // 3. Line 2 Motorized Valve (z = -14.0)
    const v2Geo = new THREE.SphereGeometry(0.48, 16, 16);
    const v2Body = new THREE.Mesh(v2Geo, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
    v2Body.position.set(xLine2, refillGroundY, -14.0);
    refillGroup.add(v2Body);

    const act2Geo = new THREE.BoxGeometry(0.75, 0.75, 0.75);
    const act2 = new THREE.Mesh(act2Geo, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 }));
    act2.position.set(xLine2, refillGroundY + 0.7, -14.0);
    refillGroup.add(act2);

    const v2LedGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const v2LedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 });
    refillValve2LedRef.current = v2LedMat;
    const v2Led = new THREE.Mesh(v2LedGeo, v2LedMat);
    v2Led.position.set(xLine2, refillGroundY + 1.15, -14.0);
    refillGroup.add(v2Led);

    // Feeder pipe to base of Riser 2 at z = -16.0
    const feed2Geo = new THREE.CylinderGeometry(0.26, 0.26, 1.8, 16);
    const feed2 = new THREE.Mesh(feed2Geo, pipeSSMat);
    feed2.rotation.x = Math.PI / 2;
    feed2.position.set(xLine2, refillGroundY, -15.1);
    feed2.castShadow = true;
    refillGroup.add(feed2);

    // 4. Line 2 Vertical Riser (x = -25.2, z = -16.0)
    const riser2Geo = new THREE.CylinderGeometry(0.28, 0.28, riserHeight, 16);
    const riser2 = new THREE.Mesh(riser2Geo, pipeSSMat);
    riser2.position.set(xLine2, (refillGroundY + refillUpsideY) / 2, -16.0);
    riser2.castShadow = true;
    refillGroup.add(riser2);

    const riser2GlassGeo = new THREE.CylinderGeometry(0.31, 0.31, riserHeight * 0.98, 16);
    const riser2Glass = new THREE.Mesh(riser2GlassGeo, flowGlassMat);
    riser2Glass.position.set(xLine2, (refillGroundY + refillUpsideY) / 2, -16.0);
    refillGroup.add(riser2Glass);

    // 5. Line 2 Upside Horizontal Pipe (Runs from x = -25.2 past Tank 1 to Tank 2 at x = 16.0)
    const pipe2Len = 41.2; // from -25.2 to 16.0
    const pipe2Geo = new THREE.CylinderGeometry(0.28, 0.28, pipe2Len, 20);
    const pipe2 = new THREE.Mesh(pipe2Geo, pipeSSMat);
    pipe2.rotation.z = Math.PI / 2;
    pipe2.position.set(xLine2 + pipe2Len / 2, refillUpsideY, -16.0);
    pipe2.castShadow = true;
    refillGroup.add(pipe2);

    const pipe2GlassGeo = new THREE.CylinderGeometry(0.31, 0.31, pipe2Len * 0.98, 20);
    const pipe2Glass = new THREE.Mesh(pipe2GlassGeo, flowGlassMat);
    pipe2Glass.rotation.z = Math.PI / 2;
    pipe2Glass.position.set(xLine2 + pipe2Len / 2, refillUpsideY, -16.0);
    refillGroup.add(pipe2Glass);

    // 6. Line 2 Top Inlet Drop into Tank 2 (x = 16.0)
    const topBranch2Geo = new THREE.CylinderGeometry(0.26, 0.26, 1.0, 16);
    const topBranch2 = new THREE.Mesh(topBranch2Geo, pipeSSMat);
    topBranch2.rotation.x = Math.PI / 2;
    topBranch2.position.set(16.0, refillUpsideY, -15.5);
    topBranch2.castShadow = true;
    refillGroup.add(topBranch2);

    const drop2Geo = new THREE.CylinderGeometry(0.26, 0.26, 0.8, 16);
    const drop2 = new THREE.Mesh(drop2Geo, pipeSSMat);
    drop2.position.set(16.0, refillUpsideY - 0.4, -15.0);
    refillGroup.add(drop2);

    const fl2Geo = new THREE.CylinderGeometry(0.44, 0.44, 0.12, 16);
    const fl2 = new THREE.Mesh(fl2Geo, ssRingMat);
    fl2.position.set(16.0, refillUpsideY - 0.75, -15.0);
    refillGroup.add(fl2);

    const check2Geo = new THREE.CylinderGeometry(0.36, 0.36, 0.4, 16);
    const check2 = new THREE.Mesh(check2Geo, new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7 }));
    check2.rotation.x = Math.PI / 2;
    check2.position.set(16.0, refillUpsideY, -15.8);
    refillGroup.add(check2);

    const v2BoxGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const v2Box = new THREE.Mesh(v2BoxGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    v2Box.position.set(16.0, refillUpsideY, -15.3);
    refillGroup.add(v2Box);

    const v2HandleGeo = new THREE.BoxGeometry(0.08, 0.42, 0.12);
    const v2Handle = new THREE.Mesh(v2HandleGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
    v2Handle.position.set(16.0, refillUpsideY + 0.3, -15.3);
    refillGroup.add(v2Handle);

    // --- D. SHARED STRUCTURAL STEEL RISER TOWER & STANCHIONS ---
    const towerGeo = new THREE.BoxGeometry(4.8, riserHeight, 2.4);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, wireframe: true });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(-26.7, (refillGroundY + refillUpsideY) / 2, -16.6);
    refillGroup.add(tower);

    const towerBaseGeo = new THREE.BoxGeometry(5.2, 0.4, 2.8);
    const towerBase = new THREE.Mesh(towerBaseGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
    towerBase.position.set(-26.7, 0.2, -16.6);
    refillGroup.add(towerBase);

    [-20, -10, 0, 10].forEach((sx) => {
      const stanchionGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 12);
      const stanchion = new THREE.Mesh(stanchionGeo, ssRingMat);
      stanchion.position.set(sx, refillUpsideY - 1.25, -16.6);
      stanchion.castShadow = true;
      refillGroup.add(stanchion);
    });

    // --- E. DYNAMIC 3D FLOATING SPRITE FOR DUAL FLOWMETER SKID ---
    const { sprite: flowmeterBadge, update: updateFlowmeterBadge } = createDynamicFlowmeterSprite();
    flowmeterBadge.position.set(-26.7, refillGroundY + 3.8, -12.2);
    flowmeterBadge.visible = showBadges;
    flowmeterSpriteUpdateRef.current = updateFlowmeterBadge;
    refillGroup.add(flowmeterBadge);

    scene.add(refillGroup);

    // 12. FORECOURT 10 DISPENSER ISLANDS & INDIVIDUAL FEEDER BRANCHES
    const dispenserGroup = new THREE.Group();
    dispenserGroup.name = "Dispensers";

    const dispWidth = 2.4;
    const dispHeight = 4.8;
    const dispDepth = 1.6;
    const spacing = 6.4;
    const startX = -((10 - 1) * spacing) / 2; // Centers all 10 bays perfectly

    for (let i = 1; i <= 10; i++) {
      const bayX = startX + (i - 1) * spacing;
      const bayGroup = new THREE.Group();
      bayGroup.name = `Bay_${i}`;

      const isBayActive = i === activeDispenserBay && simActiveFlow;

      // 1. DEDICATED FEEDER BRANCH PIPE FROM HEADER INTO DISPENSER
      // Runs from header at (bayX, 1.6, 11.8) into dispenser rear at (bayX, 1.6, 13.2)
      const branchPipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.4, 16);
      const branchPipe = new THREE.Mesh(branchPipeGeo, isBayActive ? flowGlassMat : pipeSSMat);
      branchPipe.rotation.x = Math.PI / 2;
      branchPipe.position.set(0, 1.6, -1.5);
      bayGroup.add(branchPipe);

      // Branch Isolation Ball Valve with Yellow Handle
      const valveBoxGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const valveBox = new THREE.Mesh(valveBoxGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      valveBox.position.set(0, 1.6, -1.5);
      bayGroup.add(valveBox);

      const valveHandleGeo = new THREE.BoxGeometry(0.08, 0.5, 0.12);
      const valveHandle = new THREE.Mesh(valveHandleGeo, new THREE.MeshStandardMaterial({ color: 0xeab308 }));
      valveHandle.position.set(0, 1.85, -1.5);
      bayGroup.add(valveHandle);

      // 2. Concrete Island Curb
      const islandLength = 5.2;
      const islandWidth = 2.8;
      const islandHeight = 0.45;
      const islandGeo = new THREE.BoxGeometry(islandWidth, islandHeight, islandLength);
      const islandMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
      const island = new THREE.Mesh(islandGeo, islandMat);
      island.position.set(0, islandHeight / 2, 0);
      island.receiveShadow = true;
      island.castShadow = true;
      bayGroup.add(island);

      // Warning stripes on island ends
      [-islandLength / 2 + 0.1, islandLength / 2 - 0.1].forEach((iz) => {
        const curbStripeGeo = new THREE.BoxGeometry(islandWidth + 0.05, islandHeight, 0.15);
        const curbStripe = new THREE.Mesh(curbStripeGeo, hazardMat);
        curbStripe.position.set(0, islandHeight / 2, iz);
        bayGroup.add(curbStripe);
      });

      // Protective Steel Crash Bollards
      [-islandLength / 2 + 0.5, islandLength / 2 - 0.5].forEach((bz) => {
        const bollardGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.4, 16);
        const bollardMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6, roughness: 0.3 });
        const bollard = new THREE.Mesh(bollardGeo, bollardMat);
        bollard.position.set(0, islandHeight + 0.7, bz);
        bollard.castShadow = true;
        bayGroup.add(bollard);
      });

      // 3. Dispenser Cabinet Body
      const cabGeo = new THREE.BoxGeometry(dispWidth, dispHeight, dispDepth);
      const cabMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.25,
        roughness: 0.25,
      });
      const cabMesh = new THREE.Mesh(cabGeo, cabMat);
      cabMesh.position.set(0, islandHeight + dispHeight / 2, 0);
      cabMesh.castShadow = true;
      bayGroup.add(cabMesh);

      // Blue side panels
      const sidePanelGeo = new THREE.BoxGeometry(0.08, dispHeight * 0.85, dispDepth * 0.9);
      const bluePanelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5 });
      [-dispWidth / 2 - 0.02, dispWidth / 2 + 0.02].forEach((sx) => {
        const sidePanel = new THREE.Mesh(sidePanelGeo, bluePanelMat);
        sidePanel.position.set(sx, islandHeight + dispHeight / 2, 0);
        bayGroup.add(sidePanel);
      });

      // 4. Backlit LCD Screen
      const lcdTex = createDispenserLcdTexture(i, isBayActive);
      const lcdGeo = new THREE.PlaneGeometry(1.8, 1.35);
      const lcdMat = new THREE.MeshBasicMaterial({ map: lcdTex });
      const lcd = new THREE.Mesh(lcdGeo, lcdMat);
      lcd.position.set(0, islandHeight + dispHeight / 2 + 0.65, dispDepth / 2 + 0.03);
      bayGroup.add(lcd);

      // 5. Overhead Illuminated Bay Number Header Sign
      const headerTex = createBayHeaderTexture(i, isBayActive);
      const headerGeo = new THREE.BoxGeometry(2.5, 0.9, 0.35);
      const headerMat = new THREE.MeshStandardMaterial({
        map: headerTex,
        emissive: isBayActive ? 0x0284c7 : 0x000000,
        emissiveIntensity: isBayActive ? 0.6 : 0,
      });
      const headerSign = new THREE.Mesh(headerGeo, headerMat);
      headerSign.position.set(0, islandHeight + dispHeight + 0.55, 0);
      headerSign.castShadow = true;
      bayGroup.add(headerSign);

      // 6. Dual Flexible Delivery Hoses & Blue AdBlue Nozzles
      [-dispWidth / 2 - 0.25, dispWidth / 2 + 0.25].forEach((hx) => {
        const hoseCurve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(hx, islandHeight + dispHeight * 0.7, 0),
          new THREE.Vector3(hx * 1.3, islandHeight + dispHeight * 0.4, 0.4),
          new THREE.Vector3(hx * 1.1, islandHeight + 1.2, 0.6),
          new THREE.Vector3(hx, islandHeight + 1.8, 0.3)
        );
        const hoseGeo = new THREE.TubeGeometry(hoseCurve, 20, 0.06, 8, false);
        const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
        const hose = new THREE.Mesh(hoseGeo, hoseMat);
        bayGroup.add(hose);

        const nozzleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12);
        const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6 });
        const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
        nozzle.rotation.x = Math.PI / 4;
        nozzle.position.set(hx, islandHeight + 1.9, 0.3);
        bayGroup.add(nozzle);
      });

      // 7. Glowing Blue LED Neon Accent Strip
      const neonGeo = new THREE.BoxGeometry(dispWidth * 0.9, 0.08, 0.08);
      const neonMat = new THREE.MeshBasicMaterial({ color: isBayActive ? 0x00e5ff : 0x0284c7 });
      const neon = new THREE.Mesh(neonGeo, neonMat);
      neon.position.set(0, islandHeight + dispHeight + 0.05, dispDepth / 2 + 0.02);
      bayGroup.add(neon);

      // 8. Top 360° Status Beacon
      const beaconGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: isBayActive ? 0x00e5ff : 0x22c55e,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, islandHeight + dispHeight + 1.15, 0);
      bayGroup.add(beacon);

      bayGroup.position.set(bayX, 0, 14);
      dispenserGroup.add(bayGroup);
    }
    scene.add(dispenserGroup);

    // 13. ANIMATED FLUID FLOW SYSTEM (HIGH-VISIBILITY PARTICLE STREAMS)
    // 350 particles flowing along: Tanks -> Crossover -> Booster Pumps -> Main Pipeline -> Forecourt Header -> Dispensers
    const particleCount = 350;
    const flowPositions = new Float32Array(particleCount * 3);
    const particleProgress: number[] = [];
    const particleSpeeds: number[] = [];

    // Construct 3D Waypoint Path for Flow
    // Stream 1: Tanks through crossover to pumps
    // Stream 2: Pumps down main line
    // Stream 3: Forecourt header out to dispensers
    for (let p = 0; p < particleCount; p++) {
      particleProgress[p] = Math.random();
      particleSpeeds[p] = 0.003 + Math.random() * 0.004;
    }

    const flowGeo = new THREE.BufferGeometry();
    flowGeo.setAttribute("position", new THREE.BufferAttribute(flowPositions, 3));

    const flowMat = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.75,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const flowPoints = new THREE.Points(flowGeo, flowMat);
    scene.add(flowPoints);

    // REFILL PARTICLES FOR LINE 1 (Tank 1 Dedicated Stream)
    const refill1Count = 60;
    const refill1Positions = new Float32Array(refill1Count * 3);
    const refill1Progress: number[] = [];
    const refill1Speeds: number[] = [];
    for (let rp = 0; rp < refill1Count; rp++) {
      refill1Progress[rp] = Math.random();
      refill1Speeds[rp] = 0.005 + Math.random() * 0.005;
      refill1Positions[rp * 3] = -28.2;
      refill1Positions[rp * 3 + 1] = 1.8;
      refill1Positions[rp * 3 + 2] = -10.5;
    }
    const refillGeo1 = new THREE.BufferGeometry();
    refillGeo1.setAttribute("position", new THREE.BufferAttribute(refill1Positions, 3));
    const refillMat1 = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.85,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const refillPoints1 = new THREE.Points(refillGeo1, refillMat1);
    refillPoints1.visible = false;
    refillPoints1Ref.current = refillPoints1;
    scene.add(refillPoints1);

    // REFILL PARTICLES FOR LINE 2 (Tank 2 Dedicated Stream)
    const refill2Count = 60;
    const refill2Positions = new Float32Array(refill2Count * 3);
    const refill2Progress: number[] = [];
    const refill2Speeds: number[] = [];
    for (let rp = 0; rp < refill2Count; rp++) {
      refill2Progress[rp] = Math.random();
      refill2Speeds[rp] = 0.005 + Math.random() * 0.005;
      refill2Positions[rp * 3] = -25.2;
      refill2Positions[rp * 3 + 1] = 1.8;
      refill2Positions[rp * 3 + 2] = -10.5;
    }
    const refillGeo2 = new THREE.BufferGeometry();
    refillGeo2.setAttribute("position", new THREE.BufferAttribute(refill2Positions, 3));
    const refillMat2 = new THREE.PointsMaterial({
      color: 0x10b981,
      size: 0.85,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const refillPoints2 = new THREE.Points(refillGeo2, refillMat2);
    refillPoints2.visible = false;
    refillPoints2Ref.current = refillPoints2;
    scene.add(refillPoints2);

    // 14. RAYCASTER FOR INTERACTIVE MOUSE CLICKS
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        let current: THREE.Object3D | null = intersects[0].object;
        while (current) {
          if (current.name === "Tank1") {
            setSelectedEntity("tank1");
            break;
          } else if (current.name === "Tank2") {
            setSelectedEntity("tank2");
            break;
          }
          current = current.parent;
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    // 15. ANIMATION LOOP WITH DYNAMIC ZOOM TRANSPARENCY & PIPELINE FLOW
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      controls.update();

      if (autoRotate) {
        scene.rotation.y += 0.0025;
      }

      // DYNAMIC ZOOM TRANSPARENCY
      // When camera is close to tanks (or xRayMode is active), outer shell turns crystal clear!
      const tankCenter = new THREE.Vector3(0, 10, -15);
      const camDist = camera.position.distanceTo(tankCenter);
      // Distance range: 50 (far/opaque) down to 22 (close/transparent)
      const zoomOpacity = THREE.MathUtils.clamp((camDist - 22) / 28, 0.22, 1.0);
      const currentOpacity = xRayMode ? 0.20 : zoomOpacity;

      tankShellMaterials.forEach((mat) => {
        mat.opacity = currentOpacity;
        mat.transparent = currentOpacity < 0.98;
      });
      decalMaterials.forEach((mat) => {
        mat.opacity = currentOpacity < 0.5 ? 0.25 : 1.0;
      });

      // ANIMATE FLUID PARTICLES THROUGH PIPELINE NETWORK
      const posAttr = flowGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      const flowRateMultiplier = simActiveFlow ? 2.5 : 1.0;

      for (let p = 0; p < particleCount; p++) {
        particleProgress[p] = (particleProgress[p] + particleSpeeds[p] * flowRateMultiplier) % 1.0;
        const u = particleProgress[p];

        if (p < particleCount * 0.35) {
          // Stream A: From Tanks along Downside (Bottom) Crossover -> Downside Suction Line into Pumps
          const side = p % 2 === 0 ? -1 : 1;
          if (u < 0.45) {
            // Segment 1: Inward along Downside Crossover Header (from tank bottom nozzle at x = ±8.5 to center valve at x = 0)
            const t2 = u / 0.45;
            arr[p * 3] = side * 8.5 * (1 - t2);
            arr[p * 3 + 1] = 1.8;
            arr[p * 3 + 2] = -15.0;
          } else {
            // Segment 2: Forward along Downside Suction Line (from z = -15.0 to z = -3.0 into booster pumps)
            const t2 = (u - 0.45) / 0.55;
            arr[p * 3] = 0;
            arr[p * 3 + 1] = 1.8;
            arr[p * 3 + 2] = THREE.MathUtils.lerp(-15.0, -3.0, t2);
          }
        } else if (p < particleCount * 0.75) {
          // Stream B: Through Pump Discharge & Straight Forward along Main Supply Line to Forecourt Header
          const t2 = u;
          arr[p * 3] = 0;
          arr[p * 3 + 1] = 1.6;
          arr[p * 3 + 2] = THREE.MathUtils.lerp(-1.8, 11.8, t2);
        } else {
          // Stream C: Along Forecourt Header (X axis) & Forward into the 10 Dispensers (Z axis)
          const bayIndex = p % 10;
          const targetBayX = startX + bayIndex * spacing;
          if (u < 0.65) {
            // Spreading along Header from center (x = 0) to target bay
            const t2 = u / 0.65;
            arr[p * 3] = THREE.MathUtils.lerp(0, targetBayX, t2);
            arr[p * 3 + 1] = 1.6;
            arr[p * 3 + 2] = 11.8;
          } else {
            // Turning 90 degrees forward directly into dispenser cabinet
            const t2 = (u - 0.65) / 0.35;
            arr[p * 3] = targetBayX;
            arr[p * 3 + 1] = 1.6;
            arr[p * 3 + 2] = THREE.MathUtils.lerp(11.8, 13.5, t2);
          }
        }
      }
      posAttr.needsUpdate = true;

      // ANIMATE DUAL REFILL FLOWMETERS, VALVES, AND SEPARATE PARTICLES
      const activeRefilling = isRefillingRef.current;
      if (refillPoints1Ref.current) {
        refillPoints1Ref.current.visible = activeRefilling;
      }
      if (refillPoints2Ref.current) {
        refillPoints2Ref.current.visible = activeRefilling;
      }

      if (flowmeterSpriteUpdateRef.current) {
        flowmeterSpriteUpdateRef.current(
          activeRefilling,
          refillFlowRate1Ref.current,
          refillFlowRate2Ref.current
        );
      }

      // Valve 1 Status Indicator LED
      if (refillValve1LedRef.current) {
        if (activeRefilling) {
          refillValve1LedRef.current.color.setHex(0x10b981);
          refillValve1LedRef.current.emissive.setHex(0x059669);
          refillValve1LedRef.current.emissiveIntensity = 2.0;
        } else {
          refillValve1LedRef.current.color.setHex(0xef4444);
          refillValve1LedRef.current.emissive.setHex(0xb91c1c);
          refillValve1LedRef.current.emissiveIntensity = 0.4;
        }
      }

      // Valve 2 Status Indicator LED
      if (refillValve2LedRef.current) {
        if (activeRefilling) {
          refillValve2LedRef.current.color.setHex(0x10b981);
          refillValve2LedRef.current.emissive.setHex(0x059669);
          refillValve2LedRef.current.emissiveIntensity = 2.0;
        } else {
          refillValve2LedRef.current.color.setHex(0xef4444);
          refillValve2LedRef.current.emissive.setHex(0xb91c1c);
          refillValve2LedRef.current.emissiveIntensity = 0.4;
        }
      }

      if (activeRefilling) {
        // --- 1. Line 1 Dedicated Stream into Tank 1 (Cyan, West Track at x = -28.2) ---
        const rPosAttr1 = refillGeo1.attributes.position as THREE.BufferAttribute;
        const rArr1 = rPosAttr1.array as Float32Array;

        for (let rp = 0; rp < refill1Count; rp++) {
          refill1Progress[rp] = (refill1Progress[rp] + refill1Speeds[rp] * 2.5) % 1.0;
          const ru = refill1Progress[rp];

          if (ru < 0.15) {
            // Segment 1: Ground feeder through Flowmeter 1 & Valve 1 from z = -10.5 to base of Riser 1 at z = -17.2
            const t2 = ru / 0.15;
            rArr1[rp * 3] = -28.2;
            rArr1[rp * 3 + 1] = 1.8;
            rArr1[rp * 3 + 2] = THREE.MathUtils.lerp(-10.5, -17.2, t2);
          } else if (ru < 0.35) {
            // Segment 2: Ascending up Riser Column 1 from y = 1.8 to upside y = 11.5
            const t2 = (ru - 0.15) / 0.20;
            rArr1[rp * 3] = -28.2;
            rArr1[rp * 3 + 1] = THREE.MathUtils.lerp(1.8, 11.5, t2);
            rArr1[rp * 3 + 2] = -17.2;
          } else if (ru < 0.75) {
            // Segment 3: Upside horizontal Pipe 1 eastbound from x = -28.2 to Tank 1 top at x = -16.0
            const t2 = (ru - 0.35) / 0.40;
            rArr1[rp * 3] = THREE.MathUtils.lerp(-28.2, -16.0, t2);
            rArr1[rp * 3 + 1] = 11.5;
            rArr1[rp * 3 + 2] = -17.2;
          } else {
            // Segment 4: Top drop into Tank 1 (moves forward to z = -15.0 and down to y = 9.5)
            const t2 = (ru - 0.75) / 0.25;
            if (t2 < 0.5) {
              const t3 = t2 / 0.5;
              rArr1[rp * 3] = -16.0;
              rArr1[rp * 3 + 1] = 11.5;
              rArr1[rp * 3 + 2] = THREE.MathUtils.lerp(-17.2, -15.0, t3);
            } else {
              const t3 = (t2 - 0.5) / 0.5;
              rArr1[rp * 3] = -16.0;
              rArr1[rp * 3 + 1] = THREE.MathUtils.lerp(11.5, 9.5, t3);
              rArr1[rp * 3 + 2] = -15.0;
            }
          }
        }
        rPosAttr1.needsUpdate = true;

        // --- 2. Line 2 Dedicated Stream into Tank 2 (Emerald, East Track at x = -25.2) ---
        const rPosAttr2 = refillGeo2.attributes.position as THREE.BufferAttribute;
        const rArr2 = rPosAttr2.array as Float32Array;

        for (let rp = 0; rp < refill2Count; rp++) {
          refill2Progress[rp] = (refill2Progress[rp] + refill2Speeds[rp] * 2.5) % 1.0;
          const ru = refill2Progress[rp];

          if (ru < 0.15) {
            // Segment 1: Ground feeder through Flowmeter 2 & Valve 2 from z = -10.5 to base of Riser 2 at z = -16.0
            const t2 = ru / 0.15;
            rArr2[rp * 3] = -25.2;
            rArr2[rp * 3 + 1] = 1.8;
            rArr2[rp * 3 + 2] = THREE.MathUtils.lerp(-10.5, -16.0, t2);
          } else if (ru < 0.35) {
            // Segment 2: Ascending up Riser Column 2 from y = 1.8 to upside y = 11.5
            const t2 = (ru - 0.15) / 0.20;
            rArr2[rp * 3] = -25.2;
            rArr2[rp * 3 + 1] = THREE.MathUtils.lerp(1.8, 11.5, t2);
            rArr2[rp * 3 + 2] = -16.0;
          } else if (ru < 0.80) {
            // Segment 3: Upside horizontal Pipe 2 eastbound from x = -25.2 past Tank 1 to Tank 2 top at x = 16.0
            const t2 = (ru - 0.35) / 0.45;
            rArr2[rp * 3] = THREE.MathUtils.lerp(-25.2, 16.0, t2);
            rArr2[rp * 3 + 1] = 11.5;
            rArr2[rp * 3 + 2] = -16.0;
          } else {
            // Segment 4: Top drop into Tank 2 (moves forward to z = -15.0 and down to y = 9.5)
            const t2 = (ru - 0.80) / 0.20;
            if (t2 < 0.5) {
              const t3 = t2 / 0.5;
              rArr2[rp * 3] = 16.0;
              rArr2[rp * 3 + 1] = 11.5;
              rArr2[rp * 3 + 2] = THREE.MathUtils.lerp(-16.0, -15.0, t3);
            } else {
              const t3 = (t2 - 0.5) / 0.5;
              rArr2[rp * 3] = 16.0;
              rArr2[rp * 3 + 1] = THREE.MathUtils.lerp(11.5, 9.5, t3);
              rArr2[rp * 3 + 2] = -15.0;
            }
          }
        }
        rPosAttr2.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 16. RESIZE HANDLER
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, [simActiveFlow, autoRotate, tank1Volume, tank2Volume, activeDispenserBay, xRayMode, showBadges]);

  // Smooth Camera Presets
  const setCameraPreset = (preset: "overview" | "tanks" | "forecourt" | "pid" | "offload") => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (preset === "overview") {
      cam.position.set(0, 30, 54);
      ctrl.target.set(0, 5, -2);
    } else if (preset === "tanks") {
      // Zoom close to tanks to trigger automatic transparency
      cam.position.set(0, 14, 10);
      ctrl.target.set(0, 8, -15);
      setSelectedEntity("tank1");
    } else if (preset === "offload") {
      // Direct focus on West Bulk Refill Offload Station & Flowmeter
      cam.position.set(-36, 9, -2);
      ctrl.target.set(-26.7, 3, -13.5);
    } else if (preset === "forecourt") {
      cam.position.set(0, 14, 36);
      ctrl.target.set(0, 4, 14);
      setSelectedEntity("dispensers");
    } else if (preset === "pid") {
      cam.position.set(0, 72, 0);
      ctrl.target.set(0, 0, 0);
    }
  };

  const totalVolume = tank1Volume + tank2Volume;
  const totalCapacity = TANK_CAPACITY * 2;
  const totalPct = (totalVolume / totalCapacity) * 100;

  return (
    <div className={`site-3d-wrapper ${isModal ? "is-modal-style" : ""}`}>
      {/* Top Header Banner */}
      <div className="site-3d-header">
        <div className="header-left">
          <div className="badge-3d-pulse">3D DIGITAL TWIN</div>
          <h1 className="title-text">Almarai Kharj AdBlue Storage &amp; 10-Bay Forecourt</h1>
          <p className="subtitle-text">
            Two Interconnected 30,000 L Bulk Storage Vessels &bull; Equalized Crossover Manifold &bull; 10 Forecourt Dispensers
          </p>
        </div>

        <div className="header-right">
          <div className="stat-pill-group">
            <div className="stat-pill">
              <span className="dot green" />
              <span>Manifold: <strong>{manifoldBalanced ? "BALANCED" : "ISOLATED"}</strong></span>
            </div>
            <div className="stat-pill">
              <span className="dot blue" />
              <span>Product: <strong>AdBlue DEF (ISO 22241)</strong></span>
            </div>
            <div className="stat-pill">
              <span className="dot cyan" />
              <span>Dispensers: <strong>10 Active Bays</strong></span>
            </div>
          </div>
          {isModal && onClose && (
            <button onClick={onClose} className="btn-close-modal">✕</button>
          )}
        </div>
      </div>

      {/* Main Grid: 3D Canvas + Telemetry Inspection HUD */}
      <div className="site-3d-content-grid">
        {/* 3D Viewport Box */}
        <div className="viewport-box">
          <div ref={mountRef} className="three-mount-container" />

          {/* On-Canvas Floating 3D Camera & Flow Controls */}
          <div className="canvas-overlay-toolbar">
            <div className="camera-btn-group">
              <button onClick={() => setCameraPreset("overview")} className="btn-cam" title="Full Station 3D View">
                🌐 Station Overview
              </button>
              <button onClick={() => setCameraPreset("tanks")} className="btn-cam" title="Zoom to Tanks (Reveals Internal DEF Liquid Core)">
                🛢️ Tanks Focus
              </button>
              <button onClick={() => setCameraPreset("offload")} className="btn-cam" title="Inspect Bulk Refill Offload Skid & Flowmeter">
                ⚡ Offload Flowmeter
              </button>
              <button onClick={() => setCameraPreset("forecourt")} className="btn-cam" title="Zoom to 10 Dispensers">
                ⛽ 10-Bay Forecourt
              </button>
              <button onClick={() => setCameraPreset("pid")} className="btn-cam" title="Top-down P&ID Layout">
                📐 Top-Down P&amp;ID
              </button>
            </div>

            <div className="camera-btn-group">
              <button
                onClick={() => setXRayMode(!xRayMode)}
                className={`btn-cam toggle ${xRayMode ? "active" : ""}`}
                title="Toggle Tank Shell Transparency & Internal Liquid"
              >
                🔍 {xRayMode ? "Opaque Shell" : "X-Ray Transparent Tanks"}
              </button>
              <button
                onClick={() => setShowBadges(!showBadges)}
                className={`btn-cam toggle ${showBadges ? "active" : ""}`}
                title="Toggle 3D Floating Badges"
              >
                🏷️ {showBadges ? "Hide Badges" : "Show Badges"}
              </button>
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`btn-cam toggle ${autoRotate ? "active" : ""}`}
                title="Toggle Slow 360 Rotation"
              >
                🔄 {autoRotate ? "Pause Spin" : "360° Rotate"}
              </button>
              <button
                onClick={handleRefillBothTanks}
                className={`btn-cam toggle ${isRefilling ? "active" : ""}`}
                title="Automatically refill both bulk storage tanks to 100% capacity"
                disabled={isRefilling}
              >
                ⚡ {isRefilling ? "Refilling Tanks..." : "Refill Both Tanks"}
              </button>
            </div>
          </div>

          <div className="canvas-hint">
            <span>🔍 <strong>Zoom close to tanks</strong> to see internal transparent DEF core &bull; 🖱️ <strong>Left-Click + Drag</strong>: 360° &bull; <strong>Click Tanks</strong>: Inspect Telemetry</span>
          </div>
        </div>

        {/* Real-time Telemetry & Inspection HUD Drawer */}
        <div className="telemetry-hud-panel">
          {/* Station Storage Overview Gauge */}
          <div className="storage-summary-card">
            <div className="summary-header">
              <span className="summary-title">TOTAL DEPOT BULK STOCK</span>
              <span className="summary-pct">{totalPct.toFixed(1)}%</span>
            </div>
            <div className="capacity-bar-track">
              <div className="capacity-bar-fill" style={{ width: `${totalPct}%` }} />
            </div>
            <div className="volume-readout">
              <span className="current-litres">{totalVolume.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              <span className="max-litres">/ {totalCapacity.toLocaleString()} Litres</span>
            </div>
            <div className="ullage-note">
              Remaining Headroom for Bulk Tanker Delivery: <strong>{(totalCapacity - totalVolume).toLocaleString(undefined, { maximumFractionDigits: 0 })} L</strong>
            </div>

            {/* Live Refill Station & Flowmeter Telemetry Strip */}
            <div
              className={`refill-telemetry-strip ${isRefilling ? "active" : ""}`}
              style={{
                marginTop: "12px",
                marginBottom: "12px",
                padding: "10px 14px",
                borderRadius: "8px",
                background: isRefilling ? "rgba(16, 185, 129, 0.12)" : "rgba(30, 41, 59, 0.6)",
                border: isRefilling ? "1px solid rgba(16, 185, 129, 0.45)" : "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                transition: "all 0.3s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "11px", color: isRefilling ? "#34d399" : "#94a3b8", fontWeight: 700, letterSpacing: "0.5px" }}>
                  {isRefilling ? "⚡ DUAL BULK OFFLOAD REFILL IN PROGRESS" : "⚡ SEPARATE BULK REFILL LINES (WEST OFFLOAD SKID)"}
                </div>
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: isRefilling ? "#10b981" : "#64748b",
                    boxShadow: isRefilling ? "0 0 10px #10b981" : "none",
                    transition: "all 0.3s ease"
                  }}
                />
              </div>

              {/* Line 1 Telemetry (Tank 1 dedicated) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", background: "rgba(15, 23, 42, 0.5)", padding: "6px 10px", borderRadius: "6px" }}>
                <span style={{ color: "#38bdf8", fontWeight: 600 }}>Tank 01 Line:</span>
                <span style={{ color: "#e2e8f0" }}>
                  Valve: <strong style={{ color: isRefilling ? "#10b981" : "#f59e0b" }}>{isRefilling ? "OPEN" : "CLOSED"}</strong> &bull; Meter: <strong style={{ color: isRefilling ? "#00e5ff" : "#94a3b8" }}>{tank1RefillFlowRate.toFixed(1)} L/min</strong>
                </span>
              </div>

              {/* Line 2 Telemetry (Tank 2 dedicated) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", background: "rgba(15, 23, 42, 0.5)", padding: "6px 10px", borderRadius: "6px" }}>
                <span style={{ color: "#34d399", fontWeight: 600 }}>Tank 02 Line:</span>
                <span style={{ color: "#e2e8f0" }}>
                  Valve: <strong style={{ color: isRefilling ? "#10b981" : "#f59e0b" }}>{isRefilling ? "OPEN" : "CLOSED"}</strong> &bull; Meter: <strong style={{ color: isRefilling ? "#34d399" : "#94a3b8" }}>{tank2RefillFlowRate.toFixed(1)} L/min</strong>
                </span>
              </div>
            </div>

            {/* Automatic Tank Refill Action */}
            <div className="refill-action-container">
              <button
                className={`btn-refill-tanks ${isRefilling ? "refilling" : ""}`}
                onClick={handleRefillBothTanks}
                disabled={isRefilling}
                title="Automatically refill both bulk storage tanks to full 30,000 L capacity"
              >
                {isRefilling
                  ? "⚡ Refilling Both Tanks (Bulk Offload)..."
                  : totalVolume >= totalCapacity - 50
                  ? "🔄 Tanks Full • Click to Reset & Refill Again"
                  : "⚡ Refill Both Tanks to 100% (60,000 L)"}
              </button>
            </div>
          </div>

          {/* Quick Tank Selector Tabs */}
          <div className="entity-selector-tabs">
            <button
              className={`entity-tab ${selectedEntity === "tank1" ? "active" : ""}`}
              onClick={() => setSelectedEntity("tank1")}
            >
              Tank 1 (30kL)
            </button>
            <button
              className={`entity-tab ${selectedEntity === "tank2" ? "active" : ""}`}
              onClick={() => setSelectedEntity("tank2")}
            >
              Tank 2 (30kL)
            </button>
          </div>

          {/* Selected Tank Capacity & Remaining Stock Overview */}
          <div className="hud-detail-card animate-fade">
            <div className="detail-header">
              <div className="tank-badge">
                {selectedEntity === "tank1" ? "BULK STORAGE TANK 01" : "BULK STORAGE TANK 02"}
              </div>
              <div className="tank-status-pill green">● OPERATIONAL</div>
            </div>
            <h3 className="tank-name">
              {selectedEntity === "tank1" ? "Bulk Storage Tank 1" : "Bulk Storage Tank 2"}
            </h3>

            <div className="gauge-metric-grid">
              <div className="metric-box">
                <span className="metric-lbl">CURRENT VOLUME</span>
                <span className="metric-val primary">
                  {(selectedEntity === "tank1" ? tank1Volume : tank2Volume).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L
                </span>
                <span className="metric-sub">
                  {(((selectedEntity === "tank1" ? tank1Volume : tank2Volume) / TANK_CAPACITY) * 100).toFixed(1)}% Full
                </span>
              </div>
              <div className="metric-box">
                <span className="metric-lbl">REMAINING CAPACITY (ULLAGE)</span>
                <span className="metric-val">
                  {(TANK_CAPACITY - (selectedEntity === "tank1" ? tank1Volume : tank2Volume)).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L
                </span>
                <span className="metric-sub">Headroom Space</span>
              </div>
            </div>

            {/* Technical Specs & Status */}
            <div className="specs-list">
              <div className="spec-row">
                <span>Total Vessel Capacity</span>
                <strong className="mono">30,000.0 Litres</strong>
              </div>
              <div className="spec-row">
                <span>Available Stock</span>
                <strong className="mono" style={{ color: "#38bdf8" }}>
                  {(selectedEntity === "tank1" ? tank1Volume : tank2Volume).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Litres
                </strong>
              </div>
              <div className="spec-row">
                <span>Remaining Headroom (Ullage)</span>
                <strong className="mono" style={{ color: "#4ade80" }}>
                  {(TANK_CAPACITY - (selectedEntity === "tank1" ? tank1Volume : tank2Volume)).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Litres
                </strong>
              </div>
              <div className="spec-row">
                <span>Product Stored</span>
                <strong>AdBlue DEF (ISO 22241 Standard)</strong>
              </div>
              <div className="spec-row">
                <span>Liquid Temperature</span>
                <strong className="mono">
                  {selectedEntity === "tank1" ? "18.7 °C" : "18.5 °C"}
                </strong>
              </div>
              <div className="spec-row">
                <span>Vessel Status</span>
                <strong style={{ color: "#22c55e" }}>Normal &bull; Ready for Dispensing</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .site-3d-wrapper {
          background: #0b1329;
          color: #f8fafc;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 24px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-sizing: border-box;
          width: 100%;
        }
        .site-3d-wrapper.is-modal-style {
          max-height: 90vh;
          overflow-y: auto;
        }

        /* Header */
        .site-3d-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .badge-3d-pulse {
          display: inline-block;
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
          background: rgba(14, 165, 233, 0.2);
          border: 1px solid rgba(14, 165, 233, 0.4);
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }
        .title-text {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .subtitle-text {
          font-size: 12.5px;
          color: #94a3b8;
          margin: 4px 0 0 0;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .stat-pill-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .stat-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          background: #1e293b;
          border: 1px solid #334155;
          padding: 6px 12px;
          border-radius: 20px;
          color: #cbd5e1;
        }
        .stat-pill .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .stat-pill .dot.green { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
        .stat-pill .dot.blue { background: #3b82f6; box-shadow: 0 0 8px #3b82f6; }
        .stat-pill .dot.cyan { background: #06b6d4; box-shadow: 0 0 8px #06b6d4; }
        .btn-close-modal {
          background: #334155;
          border: none;
          color: #fff;
          border-radius: 6px;
          width: 32px;
          height: 32px;
          cursor: pointer;
        }

        /* Content Grid */
        .site-3d-content-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
        }
        @media (max-width: 1050px) {
          .site-3d-content-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .site-3d-header-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .site-3d-badge-row {
            flex-wrap: wrap;
            gap: 6px;
          }
          .viewport-box {
            min-height: 420px;
          }
          .three-mount-container {
            height: 420px;
          }
          .canvas-overlay-toolbar {
            top: 8px;
            left: 8px;
            right: 8px;
          }
          .camera-btn-group {
            flex-wrap: wrap;
            padding: 2px;
            gap: 4px;
          }
          .btn-cam {
            font-size: 10px;
            padding: 4px 8px;
          }
          .canvas-hint {
            font-size: 9.5px;
            padding: 4px 8px;
            bottom: 8px;
            left: 8px;
            right: 8px;
          }
        }
        @media (max-width: 480px) {
          .viewport-box {
            min-height: 350px;
          }
          .three-mount-container {
            height: 350px;
          }
          .current-litres {
            font-size: 20px;
          }
        }

        /* Viewport Box */
        .viewport-box {
          position: relative;
          background: #090e1a;
          border-radius: 12px;
          border: 1px solid #1e293b;
          overflow: hidden;
          min-height: 580px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .three-mount-container {
          width: 100%;
          height: 580px;
          display: block;
        }

        /* On-Canvas Toolbar */
        .canvas-overlay-toolbar {
          position: absolute;
          top: 14px;
          left: 14px;
          right: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          pointer-events: none;
          flex-wrap: wrap;
          gap: 8px;
        }
        .camera-btn-group {
          display: flex;
          gap: 6px;
          pointer-events: auto;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          padding: 4px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .btn-cam {
          background: transparent;
          border: none;
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-cam:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }
        .btn-cam.toggle.active {
          background: #0284c7;
          color: #ffffff;
        }

        .canvas-hint {
          position: absolute;
          bottom: 12px;
          left: 14px;
          right: 14px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          pointer-events: none;
        }

        /* Telemetry HUD Panel */
        .telemetry-hud-panel {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* Storage Summary Card */
        .storage-summary-card {
          background: linear-gradient(135deg, #0c1a3b, #112656);
          border: 1.5px solid #0284c7;
          border-radius: 10px;
          padding: 16px;
        }
        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .summary-title {
          font-size: 11px;
          font-weight: 800;
          color: #38bdf8;
          letter-spacing: 0.06em;
        }
        .summary-pct {
          font-size: 14px;
          font-weight: 800;
          color: #ffffff;
        }
        .capacity-bar-track {
          width: 100%;
          height: 10px;
          background: rgba(15, 23, 42, 0.7);
          border-radius: 5px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .capacity-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #0284c7, #38bdf8);
          border-radius: 5px;
          transition: width 0.4s ease;
        }
        .volume-readout {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .current-litres {
          font-size: 24px;
          font-weight: 900;
          color: #ffffff;
          font-family: 'JetBrains Mono', monospace;
        }
        .max-litres {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 600;
        }
        .ullage-note {
          font-size: 10.5px;
          color: #bae6fd;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .refill-action-container {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }
        .btn-refill-tanks {
          width: 100%;
          background: linear-gradient(135deg, #0284c7, #0369a1);
          border: 1.5px solid #38bdf8;
          color: #ffffff;
          padding: 11px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          letter-spacing: 0.02em;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-refill-tanks:hover:not(:disabled) {
          background: linear-gradient(135deg, #0ea5e9, #0284c7);
          box-shadow: 0 6px 22px rgba(14, 165, 233, 0.65);
          transform: translateY(-1px);
        }
        .btn-refill-tanks:active:not(:disabled) {
          transform: translateY(1px);
        }
        .btn-refill-tanks.refilling {
          background: linear-gradient(135deg, #059669, #10b981);
          border-color: #34d399;
          animation: refill-pulse 1s infinite alternate;
        }
        @keyframes refill-pulse {
          0% { box-shadow: 0 0 10px rgba(52, 211, 153, 0.4); }
          100% { box-shadow: 0 0 24px rgba(52, 211, 153, 0.85); }
        }

        /* Entity Selector Tabs */
        .entity-selector-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          background: #0f172a;
          padding: 5px;
          border-radius: 8px;
          border: 1px solid #1e293b;
        }
        .entity-tab {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 11.5px;
          font-weight: 700;
          padding: 8px 6px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .entity-tab.active {
          background: #0284c7;
          color: #ffffff;
        }

        /* HUD Detail Card */
        .hud-detail-card {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 16px;
        }
        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .tank-badge {
          font-size: 9.5px;
          font-weight: 800;
          color: #38bdf8;
          letter-spacing: 0.06em;
        }
        .tank-status-pill {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .tank-status-pill.green {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }
        .tank-status-pill.blue {
          background: rgba(14, 165, 233, 0.2);
          color: #38bdf8;
        }
        .tank-name {
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 12px 0;
        }

        .gauge-metric-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 14px;
        }
        .metric-box {
          background: #1e293b;
          padding: 10px;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
        }
        .metric-lbl {
          font-size: 8.5px;
          color: #94a3b8;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .metric-val {
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
          margin: 2px 0;
          font-family: 'JetBrains Mono', monospace;
        }
        .metric-val.primary {
          color: #38bdf8;
        }
        .metric-sub {
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
        }

        .specs-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .spec-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .spec-row span {
          color: #94a3b8;
        }
        .spec-row strong {
          color: #f1f5f9;
        }
        .spec-row strong.mono {
          font-family: 'JetBrains Mono', monospace;
        }

        .dispenser-pills-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }
        .bay-pill {
          background: #1e293b;
          border: 1px solid #334155;
          padding: 6px 4px;
          border-radius: 6px;
          text-align: center;
        }
        .bay-pill.active-bay {
          border-color: #0284c7;
          background: rgba(2, 132, 199, 0.2);
        }
        .bay-num {
          font-size: 11px;
          font-weight: 800;
          color: #ffffff;
        }
        .bay-status {
          font-size: 9px;
          color: #38bdf8;
          font-weight: 600;
        }

        .action-buttons-sub {
          margin-top: 14px;
        }
        .btn-quick-action {
          width: 100%;
          padding: 8px 12px;
          background: #1e293b;
          border: 1px solid #334155;
          color: #38bdf8;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-quick-action:hover {
          background: #334155;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
};
