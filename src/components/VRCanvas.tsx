import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AmbilightConfig, AmbilightSampleData, EnvironmentType, ScreenConfig } from '../types';

interface VRCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ambilightConfig: AmbilightConfig;
  screenConfig: ScreenConfig;
  environment: EnvironmentType;
  ambilightData: AmbilightSampleData;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (percent: number) => void;
  currentTime: number;
  duration: number;
  currentVideo: import('../types').VideoItem;
  onEnterVR?: () => void;
  isVRPresenting: boolean;
  setIsVRPresenting: (val: boolean) => void;
}

export const VRCanvas: React.FC<VRCanvasProps> = ({
  videoRef,
  currentVideo,
  ambilightConfig,
  screenConfig,
  environment,
  ambilightData,
  isPlaying,
  onTogglePlay,
  onSeek,
  currentTime,
  duration,
  isVRPresenting,
  setIsVRPresenting,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const screenMeshRef = useRef<THREE.Mesh | null>(null);
  const ambilightMeshRef = useRef<THREE.Mesh | null>(null);
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null);
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    top: THREE.PointLight;
    bottom: THREE.PointLight;
    left: THREE.PointLight;
    right: THREE.PointLight;
  } | null>(null);
  const environmentGroupRef = useRef<THREE.Group | null>(null);
  const vrControllersRef = useRef<{
    controllers: THREE.XRTargetRaySpace[];
    controllerGrips: THREE.XRGripSpace[];
    rayLines: THREE.Line[];
  }>({ controllers: [], controllerGrips: [], rayLines: [] });

  // Canvas for dynamic halo texture
  const haloCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const haloTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // In-VR UI plane
  const vrUIMeshRef = useRef<THREE.Mesh | null>(null);
  const vrUICanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vrUITextureRef = useRef<THREE.CanvasTexture | null>(null);
  const sessionRef = useRef<any>(null);
  const bOrYWasPressedRef = useRef(false);
  const vrSessionEnterTimeRef = useRef(0);

  // Mouse look state for 2D desktop / Quest window preview
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraRotationRef = useRef({ yaw: 0, pitch: 0 });
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);

  // Check WebXR support
  useEffect(() => {
    if ('xr' in navigator && (navigator as any).xr?.isSessionSupported) {
      (navigator as any).xr.isSessionSupported('immersive-vr')
        .then((supported: boolean) => setXrSupported(supported))
        .catch(() => setXrSupported(false));
    } else {
      setXrSupported(false);
    }
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020408);
    scene.fog = new THREE.FogExp2(0x020408, 0.04);
    sceneRef.current = scene;

    // Camera (sitting in theater sweet spot at 1.4m eye height)
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    containerRef.current.appendChild(renderer.domElement);

    // Baseline cinema illumination: ensures the theater room, seats, and screen frame are ALWAYS visible in VR
    const baselineLight = new THREE.HemisphereLight(0x405580, 0x0a0f1d, 0.5);
    scene.add(baselineLight);

    // Ambilight Lights
    const ambientLight = new THREE.AmbientLight(0x0a0d18, 0.3);
    scene.add(ambientLight);

    const topLight = new THREE.PointLight(0x000000, 2.5, 22, 1.0);
    const bottomLight = new THREE.PointLight(0x000000, 2.2, 22, 1.0);
    const leftLight = new THREE.PointLight(0x000000, 2.2, 22, 1.0);
    const rightLight = new THREE.PointLight(0x000000, 2.2, 22, 1.0);

    scene.add(topLight, bottomLight, leftLight, rightLight);
    lightsRef.current = {
      ambient: ambientLight,
      top: topLight,
      bottom: bottomLight,
      left: leftLight,
      right: rightLight,
    };

    // Environment Group
    const envGroup = new THREE.Group();
    scene.add(envGroup);
    environmentGroupRef.current = envGroup;

    // Halo Canvas Setup (320x180 16:9 for real-time directional linear edge diffusion)
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 320;
    haloCanvas.height = 180;
    haloCanvasRef.current = haloCanvas;
    const haloTexture = new THREE.CanvasTexture(haloCanvas);
    haloTexture.minFilter = THREE.LinearFilter;
    haloTexture.magFilter = THREE.LinearFilter;
    haloTexture.generateMipmaps = false;
    haloTextureRef.current = haloTexture;

    // Raycaster for in-VR controller interactions
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();

    // Setup WebXR Controllers for Meta Quest 3S
    const controllers: THREE.XRTargetRaySpace[] = [];
    const rayLines: THREE.Line[] = [];

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      
      // Laser beam line for Quest controllers
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -5),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.6,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      controller.add(line);
      scene.add(controller);

      controller.addEventListener('selectstart', () => {
        // Discard any trigger clicks during the first 1200ms of entering VR (prevents entrance click from triggering actions)
        if (Date.now() - vrSessionEnterTimeRef.current < 1200) {
          return;
        }

        tempMatrix.identity().extractRotation(controller.matrixWorld);
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        // 1. Check if pointing at In-VR 3D HUD
        if (vrUIMeshRef.current && vrUIMeshRef.current.visible) {
          const intersects = raycaster.intersectObject(vrUIMeshRef.current);
          if (intersects.length > 0 && intersects[0].uv) {
            const uv = intersects[0].uv;
            const canvasX = uv.x * 640;
            const canvasY = (1 - uv.y) * 140;

            // [🚪 Quitter VR] button (X: 430 to 620, Y: 18 to 80)
            if (canvasX >= 430 && canvasX <= 620 && canvasY >= 18 && canvasY <= 80) {
              handleExitVR();
              return;
            }
            // [⏪ -10s] button (X: 190 to 290, Y: 18 to 80)
            if (canvasX >= 190 && canvasX <= 290 && canvasY >= 18 && canvasY <= 80) {
              if (videoRef.current) {
                videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
              }
              return;
            }
            // [⏩ +10s] button (X: 310 to 410, Y: 18 to 80)
            if (canvasX >= 310 && canvasX <= 410 && canvasY >= 18 && canvasY <= 80) {
              if (videoRef.current) {
                videoRef.current.currentTime = Math.min(
                  videoRef.current.duration || 9999,
                  videoRef.current.currentTime + 10
                );
              }
              return;
            }
            // [▶ / ⏸] button (X: 20 to 170, Y: 18 to 80)
            if (canvasX >= 20 && canvasX <= 170 && canvasY >= 18 && canvasY <= 80) {
              onTogglePlay();
              return;
            }
          }
        }

        // 2. Check if pointing directly at the cinema screen mesh
        if (screenMeshRef.current) {
          const screenHits = raycaster.intersectObject(screenMeshRef.current);
          if (screenHits.length > 0) {
            onTogglePlay();
            return;
          }
        }

        // Clicking outside the HUD and outside the screen in empty space does NOTHING (prevents accidental pausing)
      });

      controllers.push(controller);
      rayLines.push(line);
    }
    vrControllersRef.current = { controllers, controllerGrips: [], rayLines };

    // WebXR Session State Listeners
    renderer.xr.addEventListener('sessionstart', () => {
      vrSessionEnterTimeRef.current = Date.now();
      setIsVRPresenting(true);

      const video = videoRef.current;
      if (video) {
        // Ensure video is playing and not stalled
        video.muted = false;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Playback resume on sessionstart:', err);
          });
        }
      }

      if (videoTextureRef.current) {
        videoTextureRef.current.needsUpdate = true;
      }
    });

    renderer.xr.addEventListener('sessionend', () => {
      sessionRef.current = null;
      setIsVRPresenting(false);
      camera.position.set(0, 1.4, 0);
      cameraRotationRef.current = { yaw: 0, pitch: 0 };
    });

    // Register WebXR offerSession for Meta Quest Browser
    // This allows Meta Quest Browser's native "Entrer en mode immersif" button to seamlessly connect to Three.js
    if ('xr' in navigator && typeof (navigator as any).xr?.offerSession === 'function') {
      const offerOptions = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
      };
      (navigator as any).xr.offerSession('immersive-vr', offerOptions)
        .then(async (session: any) => {
          sessionRef.current = session;
          await renderer.xr.setSession(session);
          setIsVRPresenting(true);
          const video = videoRef.current;
          if (video) {
            video.muted = false;
            video.play().catch(() => {});
          }
        })
        .catch((err: any) => {
          console.warn('offerSession registration notice:', err);
        });
    }

    // In-VR floating HUD setup (640x140 high resolution canvas)
    const vrUICanvas = document.createElement('canvas');
    vrUICanvas.width = 640;
    vrUICanvas.height = 140;
    vrUICanvasRef.current = vrUICanvas;
    const vrUITexture = new THREE.CanvasTexture(vrUICanvas);
    vrUITextureRef.current = vrUITexture;

    const vrUIGeom = new THREE.PlaneGeometry(1.6, 0.35);
    const vrUIMat = new THREE.MeshBasicMaterial({
      map: vrUITexture,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const vrUIMesh = new THREE.Mesh(vrUIGeom, vrUIMat);
    vrUIMesh.position.set(0, 0.65, -2.1);
    vrUIMesh.rotation.x = -0.25;
    scene.add(vrUIMesh);
    vrUIMeshRef.current = vrUIMesh;

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      // Force video texture update whenever video is ready
      if (videoTextureRef.current && videoRef.current) {
        if (videoRef.current.readyState >= 1) {
          videoTextureRef.current.needsUpdate = true;
        }
      }

      // Rotate camera if dragging in 2D mode
      if (!renderer.xr.isPresenting && cameraRef.current) {
        cameraRef.current.rotation.order = 'YXZ';
        cameraRef.current.rotation.y = cameraRotationRef.current.yaw;
        cameraRef.current.rotation.x = cameraRotationRef.current.pitch;
      }

      // Check Quest controller hardware buttons (B or Y button exits VR)
      if (renderer.xr.isPresenting) {
        const session = renderer.xr.getSession();
        if (session && session.inputSources) {
          let bOrYPressed = false;
          for (const source of session.inputSources) {
            if (source.gamepad && source.gamepad.buttons) {
              // Button 4 / 5 are B / Y on Meta Quest Touch controllers
              const b4 = source.gamepad.buttons[4];
              const b5 = source.gamepad.buttons[5];
              if ((b4 && b4.pressed) || (b5 && b5.pressed)) {
                bOrYPressed = true;
                if (!bOrYWasPressedRef.current) {
                  bOrYWasPressedRef.current = true;
                  handleExitVR();
                  break;
                }
              }
            }
          }
          if (!bOrYPressed) {
            bOrYWasPressedRef.current = false;
          }
        }
      }

      // In-VR 3D HUD is only visible while presenting in the VR headset
      if (vrUIMeshRef.current) {
        vrUIMeshRef.current.visible = renderer.xr.isPresenting;
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.setAnimationLoop(null);
      if (renderer.domElement && renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update In-VR HUD texture
  useEffect(() => {
    const canvas = vrUICanvasRef.current;
    const texture = vrUITextureRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background container
    ctx.fillStyle = 'rgba(6, 10, 20, 0.92)';
    ctx.beginPath();
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Button 1: [▶ LECTURE / ⏸ PAUSE] (X: 20 to 170, Y: 18 to 80)
    ctx.fillStyle = isPlaying ? 'rgba(234, 179, 8, 0.18)' : 'rgba(14, 165, 233, 0.18)';
    ctx.beginPath();
    ctx.roundRect(20, 18, 150, 62, 14);
    ctx.fill();
    ctx.strokeStyle = isPlaying ? '#eab308' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isPlaying ? '⏸ PAUSE' : '▶ LECTURE', 95, 56);

    // Button 2: [⏪ -10s] (X: 190 to 290, Y: 18 to 80)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(190, 18, 100, 62, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('⏪ -10s', 240, 56);

    // Button 3: [⏩ +10s] (X: 310 to 410, Y: 18 to 80)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(310, 18, 100, 62, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('⏩ +10s', 360, 56);

    // Button 4: [🚪 Quitter VR] (X: 430 to 620, Y: 18 to 80)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.beginPath();
    ctx.roundRect(430, 18, 190, 62, 14);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('🚪 Quitter VR', 525, 56);

    // Time text & Progress bar at bottom
    const formatTime = (sec: number) => {
      if (typeof sec !== 'number' || !isFinite(sec) || isNaN(sec) || sec < 0) return '0:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };
    const validCurrentTime = (typeof currentTime === 'number' && isFinite(currentTime) && currentTime >= 0) ? currentTime : 0;
    const validDuration = (typeof duration === 'number' && isFinite(duration) && duration > 0) ? duration : 0;

    const barX = 24;
    const barY = 96;
    const barW = canvas.width - 48;
    const barH = 10;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fill();

    const progress = validDuration > 0 ? Math.max(0, Math.min(1, validCurrentTime / validDuration)) : 0;
    const progressWidth = Math.max(8, Math.min(barW, Math.round(barW * progress)));
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(barX, barY, progressWidth, barH, 5);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText(`${formatTime(validCurrentTime)} / ${formatTime(validDuration)}`, 24, 126);

    texture.needsUpdate = true;
  }, [isPlaying, currentTime, duration, ambilightConfig.enabled]);

  // Build Virtual Environment (Grand Cinema, Void, Living Room, Cosmic)
  useEffect(() => {
    const scene = sceneRef.current;
    const envGroup = environmentGroupRef.current;
    if (!scene || !envGroup) return;

    // Clear previous environment meshes
    while (envGroup.children.length > 0) {
      const child = envGroup.children[0];
      envGroup.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }

    if (environment === 'cinema') {
      // Grand IMAX Theater Room (Smooth, seamless matte acoustic theater)
      // Seating floor (covers only the viewer seating area under and behind camera - leaves front completely open)
      const floorGeom = new THREE.PlaneGeometry(32, 17);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x05070c,
        roughness: 0.96,
        metalness: 0.04,
      });
      const floor = new THREE.Mesh(floorGeom, floorMat);
      floor.rotation.x = -Math.PI / 2;
      // Positioned from z = -1.0 (in front of viewer feet) back to z = +16 (behind seating rows)
      floor.position.set(0, 0, 7.5);
      envGroup.add(floor);

      // Sunken stage pit floor (way down at y = -8m so bottom halo never clips, exactly like in nebula mode)
      const pitFloorGeom = new THREE.PlaneGeometry(48, 24);
      const pitFloorMat = new THREE.MeshStandardMaterial({
        color: 0x010204,
        roughness: 0.98,
      });
      const pitFloor = new THREE.Mesh(pitFloorGeom, pitFloorMat);
      pitFloor.rotation.x = -Math.PI / 2;
      pitFloor.position.set(0, -8, -6);
      envGroup.add(pitFloor);

      // Ceiling
      const ceilingGeom = new THREE.PlaneGeometry(36, 36);
      const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x030408,
        roughness: 0.98,
      });
      const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = 12;
      envGroup.add(ceiling);

      // Back Screen Wall (Extends from y = -14m up to y = +16m - allows full downward halo diffusion)
      const backWallGeom = new THREE.PlaneGeometry(48, 34);
      const backWallMat = new THREE.MeshStandardMaterial({
        color: 0x05070c,
        roughness: 0.98, // Pure matte absorption, perfect for soft ambilight reflection
        metalness: 0.02,
      });
      const backWall = new THREE.Mesh(backWallGeom, backWallMat);
      backWall.position.set(0, 1, -screenConfig.distance - 1.2);
      envGroup.add(backWall);

      // Left Wall (Extends deep downward and upward)
      const leftWallGeom = new THREE.PlaneGeometry(36, 32);
      const sideWallMat = new THREE.MeshStandardMaterial({
        color: 0x06080e,
        roughness: 0.95,
        metalness: 0.03,
      });
      const leftWall = new THREE.Mesh(leftWallGeom, sideWallMat);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.position.set(-13, 2, -5);
      envGroup.add(leftWall);

      // Right Wall
      const rightWall = new THREE.Mesh(leftWallGeom, sideWallMat);
      rightWall.rotation.y = -Math.PI / 2;
      rightWall.position.set(13, 2, -5);
      envGroup.add(rightWall);

      // Cinema seats: Placed behind the viewer (VIP front row view) so screen is never blocked
      const seatGroup = new THREE.Group();
      for (let row = 1; row <= 3; row++) {
        const seatRowGeom = new THREE.BoxGeometry(16, 0.75, 0.8);
        const seatRowMat = new THREE.MeshStandardMaterial({
          color: 0x140a12, // Dark theater velvet maroon
          roughness: 0.95,
        });
        const seatRow = new THREE.Mesh(seatRowGeom, seatRowMat);
        // Elevated stadium rows behind the viewer
        seatRow.position.set(0, 0.4 + (row - 1) * 0.35, row * 1.6 + 0.4);
        seatGroup.add(seatRow);
      }
      envGroup.add(seatGroup);
    } else if (environment === 'void') {
      // Pure OLED Void: deep obsidian infinity with zero grid lines
      const voidFloorGeom = new THREE.PlaneGeometry(80, 80);
      const voidFloorMat = new THREE.MeshStandardMaterial({
        color: 0x010204,
        roughness: 0.98,
      });
      const voidFloor = new THREE.Mesh(voidFloorGeom, voidFloorMat);
      voidFloor.rotation.x = -Math.PI / 2;
      voidFloor.position.y = -0.2;
      envGroup.add(voidFloor);
    } else if (environment === 'lounge') {
      // Minimalist Modern Home Theater Lounge (Floor behind viewer, open downward diffusion)
      const floorGeom = new THREE.PlaneGeometry(24, 16);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x12100e, // Dark walnut parquet
        roughness: 0.6,
        metalness: 0.1,
      });
      const floor = new THREE.Mesh(floorGeom, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, 0, 7.5);
      envGroup.add(floor);

      const wallGeom = new THREE.PlaneGeometry(36, 26);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x0c0f16,
        roughness: 0.92,
      });
      const wall = new THREE.Mesh(wallGeom, wallMat);
      wall.position.set(0, 2, -screenConfig.distance - 0.6);
      envGroup.add(wall);
    } else if (environment === 'cosmic') {
      // Cosmic Space with 1200 glittering stars
      const starCount = 1400;
      const starGeom = new THREE.BufferGeometry();
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * 80;
        const y = (Math.random() - 0.5) * 60 + 10;
        const z = (Math.random() - 0.5) * 80;
        starPositions[i * 3] = x;
        starPositions[i * 3 + 1] = y;
        starPositions[i * 3 + 2] = z;

        const tint = Math.random();
        starColors[i * 3] = 0.7 + tint * 0.3;
        starColors[i * 3 + 1] = 0.8 + tint * 0.2;
        starColors[i * 3 + 2] = 1.0;
      }

      starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      });
      const starPoints = new THREE.Points(starGeom, starMat);
      envGroup.add(starPoints);
    }
  }, [environment, screenConfig.distance]);

  // Construct or Rebuild Curved Cinema Screen & Ambilight Halo Mesh
  useEffect(() => {
    const scene = sceneRef.current;
    const video = videoRef.current;
    if (!scene || !video) return;

    // Remove old meshes
    if (screenMeshRef.current) {
      scene.remove(screenMeshRef.current);
      screenMeshRef.current.geometry.dispose();
    }
    if (ambilightMeshRef.current) {
      scene.remove(ambilightMeshRef.current);
      ambilightMeshRef.current.geometry.dispose();
    }

    // Dispose old texture if any
    if (videoTextureRef.current) {
      videoTextureRef.current.dispose();
    }

    // Video Texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTextureRef.current = videoTexture;

    // Screen Dimensions based on Aspect Ratio and Scale
    let aspect = 16 / 9;
    if (video.videoWidth > 0 && video.videoHeight > 0 && screenConfig.aspectRatio === '16:9') {
      aspect = video.videoWidth / video.videoHeight;
    } else if (screenConfig.aspectRatio === '21:9') {
      aspect = 21 / 9;
    } else if (screenConfig.aspectRatio === '4:3') {
      aspect = 4 / 3;
    }

    const baseWidth = 5.6 * screenConfig.size;
    const baseHeight = baseWidth / aspect;

    // Curved Screen Mesh Construction
    // Built from a subdivision plane centered exactly at z=0, curving forward towards viewer
    const segmentsX = 48;
    const segmentsY = 16;
    const curveStrength = screenConfig.curvature * 0.85;

    const screenGeom = new THREE.PlaneGeometry(baseWidth, baseHeight, segmentsX, segmentsY);
    if (curveStrength > 0.01) {
      const radius = (baseWidth * 1.2) / curveStrength;
      const pos = screenGeom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        // Curve forward towards viewer (+z) as x moves away from center
        const zOffset = radius - Math.sqrt(Math.max(0, radius * radius - x * x));
        pos.setZ(i, zOffset);
      }
      screenGeom.computeVertexNormals();
    }
    screenGeom.computeBoundingBox();
    screenGeom.computeBoundingSphere();

    // Massive atmospheric halo backing: expands to envelop the entire visual field without edges
    const haloScale = 1.0 + 2.5 * Math.max(0.6, ambilightConfig.spread);
    const haloGeom = new THREE.PlaneGeometry(baseWidth * haloScale, baseHeight * haloScale, segmentsX, segmentsY);
    if (curveStrength > 0.01) {
      const radius = (baseWidth * haloScale * 1.2) / curveStrength;
      const haloPos = haloGeom.attributes.position;
      for (let i = 0; i < haloPos.count; i++) {
        const x = haloPos.getX(i);
        const zOffset = radius - Math.sqrt(Math.max(0, radius * radius - x * x));
        haloPos.setZ(i, zOffset);
      }
      haloGeom.computeVertexNormals();
    }
    haloGeom.computeBoundingBox();
    haloGeom.computeBoundingSphere();

    // Screen Material (Front with video texture, subtle emission)
    const screenMat = new THREE.MeshBasicMaterial({
      map: videoTexture,
      side: THREE.DoubleSide,
    });

    const screenMesh = new THREE.Mesh(screenGeom, screenMat);
    screenMesh.frustumCulled = false;

    // Ambilight Halo Material (Additive blending for luminous aura)
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTextureRef.current,
      transparent: true,
      opacity: ambilightConfig.enabled ? 0.85 : 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const ambilightMesh = new THREE.Mesh(haloGeom, haloMat);
    ambilightMesh.frustumCulled = false;

    // Positioning
    const dist = screenConfig.distance;
    // Calculate vertical position ensuring the screen bottom is cleanly elevated above the floor in all modes
    const minBottomClearance = 0.35; // 35 cm clearance above ground
    const baseCenterY = (baseHeight / 2) + minBottomClearance;
    const posY = baseCenterY + screenConfig.heightOffset;
    const tiltRad = (screenConfig.tilt * Math.PI) / 180;

    screenMesh.position.set(0, posY, -dist);
    screenMesh.rotation.x = tiltRad;

    // Ambilight halo mesh positioned right behind screen (1.5cm offset) for seamless edge contact
    ambilightMesh.position.set(0, posY, -dist - 0.015);
    ambilightMesh.rotation.x = tiltRad;

    scene.add(ambilightMesh);
    scene.add(screenMesh);

    screenMeshRef.current = screenMesh;
    ambilightMeshRef.current = ambilightMesh;

    // Update lights positions directly at the screen perimeter edges
    if (lightsRef.current) {
      lightsRef.current.top.position.set(0, posY + baseHeight / 2, -dist - 0.04);
      lightsRef.current.bottom.position.set(0, posY - baseHeight / 2, -dist - 0.04);
      lightsRef.current.left.position.set(-baseWidth / 2, posY, -dist - 0.04);
      lightsRef.current.right.position.set(baseWidth / 2, posY, -dist - 0.04);
    }
  }, [
    currentVideo.url,
    screenConfig.curvature,
    screenConfig.distance,
    screenConfig.size,
    screenConfig.heightOffset,
    screenConfig.tilt,
    screenConfig.aspectRatio,
    ambilightConfig.spread,
    ambilightConfig.enabled,
  ]);

  // Video texture refresh event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoReady = () => {
      if (videoTextureRef.current) {
        videoTextureRef.current.needsUpdate = true;
      }
    };

    video.addEventListener('loadedmetadata', handleVideoReady);
    video.addEventListener('loadeddata', handleVideoReady);
    video.addEventListener('canplay', handleVideoReady);
    video.addEventListener('playing', handleVideoReady);
    video.addEventListener('seeked', handleVideoReady);
    video.addEventListener('timeupdate', handleVideoReady);

    return () => {
      video.removeEventListener('loadedmetadata', handleVideoReady);
      video.removeEventListener('loadeddata', handleVideoReady);
      video.removeEventListener('canplay', handleVideoReady);
      video.removeEventListener('playing', handleVideoReady);
      video.removeEventListener('seeked', handleVideoReady);
      video.removeEventListener('timeupdate', handleVideoReady);
    };
  }, [currentVideo.url]);

  // Real-time Ambilight Update on Texture & Lights
  useEffect(() => {
    if (!ambilightConfig.enabled || !lightsRef.current) {
      if (lightsRef.current) {
        lightsRef.current.ambient.color.setHex(0x0a0d18);
        lightsRef.current.ambient.intensity = 0.25;
        lightsRef.current.top.intensity = 0;
        lightsRef.current.bottom.intensity = 0;
        lightsRef.current.left.intensity = 0;
        lightsRef.current.right.intensity = 0;
      }
      if (ambilightMeshRef.current) {
        (ambilightMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      return;
    }

    if (ambilightMeshRef.current) {
      (ambilightMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.70 * ambilightConfig.intensity;
    }

    // Dynamic Multi-Zone Halo Canvas Generation (Anamorphic 16:9 Widescreen Diffusion)
    const canvas = haloCanvasRef.current;
    const texture = haloTextureRef.current;

    const toSafeRgba = (col?: [number, number, number], alpha: number = 1): string => {
      const r = (col && typeof col[0] === 'number' && isFinite(col[0])) ? Math.max(0, Math.min(255, Math.round(col[0]))) : 20;
      const g = (col && typeof col[1] === 'number' && isFinite(col[1])) ? Math.max(0, Math.min(255, Math.round(col[1]))) : 25;
      const b = (col && typeof col[2] === 'number' && isFinite(col[2])) ? Math.max(0, Math.min(255, Math.round(col[2]))) : 35;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const toSafeRgbFloat = (col?: [number, number, number]): [number, number, number] => {
      const r = (col && typeof col[0] === 'number' && isFinite(col[0])) ? Math.max(0, Math.min(1, col[0] / 255)) : 0.08;
      const g = (col && typeof col[1] === 'number' && isFinite(col[1])) ? Math.max(0, Math.min(1, col[1] / 255)) : 0.1;
      const b = (col && typeof col[2] === 'number' && isFinite(col[2])) ? Math.max(0, Math.min(1, col[2] / 255)) : 0.15;
      return [r, g, b];
    };

    // Helper to calculate average color of an array of RGB triplets
    const calcAvgColor = (arr?: [number, number, number][]): [number, number, number] => {
      if (!arr || arr.length === 0) return [20, 25, 35];
      let r = 0, g = 0, b = 0;
      for (const c of arr) {
        r += c[0] || 0;
        g += c[1] || 0;
        b += c[2] || 0;
      }
      return [r / arr.length, g / arr.length, b / arr.length];
    };

    if (canvas && texture) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const glowAlpha = Math.min(1, 0.75 * ambilightConfig.intensity);
        const top = ambilightData.top || [];
        const bot = ambilightData.bottom || [];
        const left = ambilightData.left || [];
        const right = ambilightData.right || [];
        const gradientSteps = typeof ambilightConfig.gradientSteps === 'number' ? ambilightConfig.gradientSteps : 0;

        const W = canvas.width;  // 320
        const H = canvas.height; // 180

        // Screen geometry on halo canvas matching 3D visual aspect ratio exactly
        const haloScale = 1.0 + 2.5 * Math.max(0.6, ambilightConfig.spread);
        const screenW = W / haloScale;
        const screenH = H / haloScale;
        const screenX = (W - screenW) / 2;
        const screenY = (H - screenH) / 2;
        const screenRight = screenX + screenW;
        const screenBottom = screenY + screenH;

        // Anti-aliased stepped or continuous brightness falloff B(u)
        // u = 0.0 at screen edge -> 1.0 at outer room darkness
        const computeB = (u: number): number => {
          if (u >= 1.0) return 0;
          if (u <= 0.0) return 1.0;

          if (gradientSteps <= 0) {
            // Continu / analogique fluide
            return Math.pow(1 - u, 1.35);
          }

          // Exactly N intermediate nuances between screen edge (1.0) and black room (0.0)
          const numIntervals = gradientSteps + 1;
          const pos = u * numIntervals;
          const stepIndex = Math.floor(pos);
          if (stepIndex >= numIntervals) return 0;

          const currentLevel = (numIntervals - stepIndex) / numIntervals;
          const nextLevel = (numIntervals - stepIndex - 1) / numIntervals;
          const frac = pos - stepIndex;

          // 75% solid nuance band, 25% smooth gradient transition to next nuance (zero aliasing)
          const plateau = 0.75;
          if (frac < plateau) {
            return currentLevel;
          } else {
            const blend = (frac - plateau) / (1 - plateau);
            const s = blend * blend * (3 - 2 * blend);
            return currentLevel + (nextLevel - currentLevel) * s;
          }
        };

        // Hermite smooth S-curve sampling along an edge array (zero pixelation on color transitions)
        const sampleEdgeSmooth = (arr: [number, number, number][], t: number): [number, number, number] => {
          if (!arr || arr.length === 0) return [0, 0, 0];
          const maxIdx = arr.length - 1;
          const pos = Math.max(0, Math.min(1, t)) * maxIdx;
          const i0 = Math.floor(pos);
          const i1 = Math.min(maxIdx, i0 + 1);
          const f = pos - i0;
          const s = f * f * (3 - 2 * f); // Hermite cubic smoothstep
          const c0 = arr[i0] || [0, 0, 0];
          const c1 = arr[i1] || [0, 0, 0];
          return [
            c0[0] + (c1[0] - c0[0]) * s,
            c0[1] + (c1[1] - c0[1]) * s,
            c0[2] + (c1[2] - c0[2]) * s,
          ];
        };

        // Direct typed buffer generation: guarantees ultra-fast rendering (0.2ms)
        const imgData = ctx.createImageData(W, H);
        const data32 = new Uint32Array(imgData.data.buffer);

        for (let y = 0; y < H; y++) {
          const rowOffset = y * W;

          for (let x = 0; x < W; x++) {
            let u = 0.0;
            let col: [number, number, number] = [0, 0, 0];

            if (y < screenY) {
              if (x >= screenX && x <= screenRight) {
                // Top band: pure vertical linear diffusion UPWARDS
                u = (screenY - y) / screenY;
                const t = (x - screenX) / screenW;
                col = sampleEdgeSmooth(top, t);
              } else if (x < screenX) {
                // Top-Left corner: diagonal radial diffusion
                const ux = (screenX - x) / screenX;
                const uy = (screenY - y) / screenY;
                u = Math.sqrt(ux * ux + uy * uy);
                const angle = Math.atan2(uy, ux) / (Math.PI / 2);
                const s = angle * angle * (3 - 2 * angle);
                const cLeft = left[0] || [0, 0, 0];
                const cTop = top[0] || [0, 0, 0];
                col = [
                  cLeft[0] * (1 - s) + cTop[0] * s,
                  cLeft[1] * (1 - s) + cTop[1] * s,
                  cLeft[2] * (1 - s) + cTop[2] * s,
                ];
              } else {
                // Top-Right corner: diagonal radial diffusion
                const ux = (x - screenRight) / (W - screenRight);
                const uy = (screenY - y) / screenY;
                u = Math.sqrt(ux * ux + uy * uy);
                const angle = Math.atan2(uy, ux) / (Math.PI / 2);
                const s = angle * angle * (3 - 2 * angle);
                const cRight = right[0] || [0, 0, 0];
                const cTop = top[top.length - 1] || [0, 0, 0];
                col = [
                  cRight[0] * (1 - s) + cTop[0] * s,
                  cRight[1] * (1 - s) + cTop[1] * s,
                  cRight[2] * (1 - s) + cTop[2] * s,
                ];
              }
            } else if (y > screenBottom) {
              if (x >= screenX && x <= screenRight) {
                // Bottom band: pure vertical linear diffusion DOWNWARDS
                u = (y - screenBottom) / (H - screenBottom);
                const t = (x - screenX) / screenW;
                col = sampleEdgeSmooth(bot, t);
              } else if (x < screenX) {
                // Bottom-Left corner: diagonal radial diffusion
                const ux = (screenX - x) / screenX;
                const uy = (y - screenBottom) / (H - screenBottom);
                u = Math.sqrt(ux * ux + uy * uy);
                const angle = Math.atan2(uy, ux) / (Math.PI / 2);
                const s = angle * angle * (3 - 2 * angle);
                const cLeft = left[left.length - 1] || [0, 0, 0];
                const cBot = bot[0] || [0, 0, 0];
                col = [
                  cLeft[0] * (1 - s) + cBot[0] * s,
                  cLeft[1] * (1 - s) + cBot[1] * s,
                  cLeft[2] * (1 - s) + cBot[2] * s,
                ];
              } else {
                // Bottom-Right corner: diagonal radial diffusion
                const ux = (x - screenRight) / (W - screenRight);
                const uy = (y - screenBottom) / (H - screenBottom);
                u = Math.sqrt(ux * ux + uy * uy);
                const angle = Math.atan2(uy, ux) / (Math.PI / 2);
                const s = angle * angle * (3 - 2 * angle);
                const cRight = right[right.length - 1] || [0, 0, 0];
                const cBot = bot[bot.length - 1] || [0, 0, 0];
                col = [
                  cRight[0] * (1 - s) + cBot[0] * s,
                  cRight[1] * (1 - s) + cBot[1] * s,
                  cRight[2] * (1 - s) + cBot[2] * s,
                ];
              }
            } else {
              // Lateral bands and center area behind screen
              if (x < screenX) {
                // Left band: diffuse pure horizontally LEFTSWARDS
                u = (screenX - x) / screenX;
                const t = (y - screenY) / screenH;
                col = sampleEdgeSmooth(left, t);
              } else if (x > screenRight) {
                // Right band: diffuse pure horizontally RIGHTWARDS
                u = (x - screenRight) / (W - screenRight);
                const t = (y - screenY) / screenH;
                col = sampleEdgeSmooth(right, t);
              } else {
                // Inside the screen boundary (behind the video mesh):
                // Fill seamlessly with closest edge color so there is NEVER a black gap/border!
                u = 0.0;
                const distL = x - screenX;
                const distR = screenRight - x;
                const distT = y - screenY;
                const distB = screenBottom - y;
                const minDist = Math.min(distL, distR, distT, distB);
                if (minDist === distT) {
                  col = sampleEdgeSmooth(top, (x - screenX) / screenW);
                } else if (minDist === distB) {
                  col = sampleEdgeSmooth(bot, (x - screenX) / screenW);
                } else if (minDist === distL) {
                  col = sampleEdgeSmooth(left, (y - screenY) / screenH);
                } else {
                  col = sampleEdgeSmooth(right, (y - screenY) / screenH);
                }
              }
            }

            // Luminance check: smooth fade to black (zero hard threshold cuts or pixelated bands)
            const lum = (col[0] * 0.299 + col[1] * 0.587 + col[2] * 0.114) / 255;
            const blackFade = Math.max(0, Math.min(1, (lum - 0.015) / 0.045));
            if (u >= 1.0 || blackFade <= 0.001) {
              data32[rowOffset + x] = 0;
              continue;
            }

            const bFactor = computeB(u) * glowAlpha * blackFade;
            const a = Math.max(0, Math.min(255, Math.round(bFactor * 255)));
            if (a === 0) {
              data32[rowOffset + x] = 0;
              continue;
            }

            const r = Math.max(0, Math.min(255, Math.round(col[0])));
            const g = Math.max(0, Math.min(255, Math.round(col[1])));
            const b = Math.max(0, Math.min(255, Math.round(col[2])));

            // Pack 32-bit little-endian RGBA: (A << 24) | (B << 16) | (G << 8) | R
            data32[rowOffset + x] = (a << 24) | (b << 16) | (g << 8) | r;
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Soft optical diffusion pass: smoothly melts all transitions, black corners, and colors into a dreamy continuous glow
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.filter = 'blur(10px)';
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();

        texture.needsUpdate = true;
      }
    }

    // Dynamic 3D lights updating in Three.js around the perimeter (Edge-Empowered with Black detection)
    const { ambient, top, bottom, left, right } = lightsRef.current;
    const mult = typeof ambilightConfig.intensity === 'number' && isFinite(ambilightConfig.intensity) ? ambilightConfig.intensity : 1;
    const wallReflect = typeof ambilightConfig.wallReflection === 'number' && isFinite(ambilightConfig.wallReflection) ? ambilightConfig.wallReflection : 0.7;

    // Ambient room color: neutral dark cinema velvet (never washes out or tints edge colors!)
    ambient.color.setHex(0x080c18);
    ambient.intensity = 0.1 * mult;

    // Top Light (Empowered strictly by top edge zones, completely OFF if top is black)
    const topAvg = calcAvgColor(ambilightData.top);
    const [tR, tG, tB] = toSafeRgbFloat(topAvg);
    top.color.setRGB(tR, tG, tB);
    const topLum = tR * 0.299 + tG * 0.587 + tB * 0.114;
    top.intensity = topLum < 0.025 ? 0 : 3.6 * mult * wallReflect * Math.min(1, topLum * 2.2);

    // Bottom Light (Empowered strictly by bottom edge zones, completely OFF if bottom is black)
    const botAvg = calcAvgColor(ambilightData.bottom);
    const [bR, bG, bB] = toSafeRgbFloat(botAvg);
    bottom.color.setRGB(bR, bG, bB);
    const botLum = bR * 0.299 + bG * 0.587 + bB * 0.114;
    bottom.intensity = botLum < 0.025 ? 0 : 3.2 * mult * wallReflect * Math.min(1, botLum * 2.2);

    // Left Light (Empowered strictly by left edge zones, completely OFF if left is black)
    const leftAvg = calcAvgColor(ambilightData.left);
    const [lR, lG, lB] = toSafeRgbFloat(leftAvg);
    left.color.setRGB(lR, lG, lB);
    const leftLum = lR * 0.299 + lG * 0.587 + lB * 0.114;
    left.intensity = leftLum < 0.025 ? 0 : 3.2 * mult * wallReflect * Math.min(1, leftLum * 2.2);

    // Right Light (Empowered strictly by right edge zones, completely OFF if right is black)
    const rightAvg = calcAvgColor(ambilightData.right);
    const [rR, rG, rB] = toSafeRgbFloat(rightAvg);
    right.color.setRGB(rR, rG, rB);
    const rightLum = rR * 0.299 + rG * 0.587 + rB * 0.114;
    right.intensity = rightLum < 0.025 ? 0 : 3.2 * mult * wallReflect * Math.min(1, rightLum * 2.2);
  }, [ambilightData, ambilightConfig]);

  // WebXR Exit Function
  const handleExitVR = async () => {
    try {
      const session = sessionRef.current || rendererRef.current?.xr?.getSession();
      if (session) {
        await session.end();
      }
    } catch (err) {
      console.warn('WebXR end session error:', err);
    } finally {
      sessionRef.current = null;
      setIsVRPresenting(false);
    }
  };

  // WebXR Launch Function
  const handleLaunchVR = async () => {
    if (!rendererRef.current) return;
    try {
      const xr = (navigator as any).xr;
      if (xr) {
        // Try local-floor first (ideal for standing / seated Quest 3S), fall back to local
        let session: any;
        try {
          session = await xr.requestSession('immersive-vr', {
            requiredFeatures: ['local-floor'],
            optionalFeatures: ['bounded-floor', 'hand-tracking'],
          });
          await rendererRef.current.xr.setReferenceSpaceType('local-floor');
        } catch {
          session = await xr.requestSession('immersive-vr', {
            optionalFeatures: ['local', 'hand-tracking'],
          });
          await rendererRef.current.xr.setReferenceSpaceType('local');
        }

        sessionRef.current = session;
        await rendererRef.current.xr.setSession(session);
        setIsVRPresenting(true);

        // Ensure video is playing and texture is active
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          }
          if (videoTextureRef.current) {
            videoTextureRef.current.needsUpdate = true;
          }
        }

        session.addEventListener('end', () => {
          sessionRef.current = null;
          setIsVRPresenting(false);
          if (cameraRef.current) {
            cameraRef.current.position.set(0, 1.4, 0);
          }
        });
      }
    } catch (err) {
      console.warn('WebXR requestSession failed or rejected:', err);
    }
  };

  // 2D Mouse Drag Look Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    cameraRotationRef.current.yaw -= deltaX * 0.003;
    cameraRotationRef.current.pitch = Math.max(
      -Math.PI / 3,
      Math.min(Math.PI / 3, cameraRotationRef.current.pitch - deltaY * 0.003)
    );

    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Reset view to screen center
  const handleRecenter = () => {
    cameraRotationRef.current = { yaw: 0, pitch: 0 };
    if (cameraRef.current) {
      cameraRef.current.rotation.set(0, 0, 0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-grab active:cursor-grabbing select-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 2D View Controls (discreetly positioned at bottom-right, keeping top-right clean for native browser controls) */}
      {!isVRPresenting && (
        <div className="absolute bottom-24 right-4 z-20 flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleRecenter}
            title="Recentrer la vue 2D"
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 backdrop-blur-sm transition-colors text-xs flex items-center gap-1.5 shadow-lg"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Recentrer la vue
          </button>
        </div>
      )}

      {/* When presenting in VR, show Exit VR button in 2D preview */}
      {isVRPresenting && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleExitVR}
            className="px-4 py-2.5 bg-red-600/90 hover:bg-red-500 text-white font-bold rounded-xl shadow-2xl transition-all text-xs flex items-center gap-2 border border-red-400/50 backdrop-blur-md"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Quitter le mode VR
          </button>
        </div>
      )}
    </div>
  );
};
