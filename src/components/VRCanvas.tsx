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
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // In-VR UI plane
  const vrUIMeshRef = useRef<THREE.Mesh | null>(null);
  const vrUICanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vrUITextureRef = useRef<THREE.CanvasTexture | null>(null);

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

    // Halo Canvas Setup (640x360 16:9 for screen-conforming anamorphic diffusion)
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 640;
    haloCanvas.height = 360;
    haloCanvasRef.current = haloCanvas;
    const haloTexture = new THREE.CanvasTexture(haloCanvas);
    haloTexture.minFilter = THREE.LinearFilter;
    haloTexture.magFilter = THREE.LinearFilter;
    haloTexture.generateMipmaps = false;
    haloTextureRef.current = haloTexture;

    // Small multi-zone sample canvas for smooth 2D Gaussian optical blur
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 8;
    sampleCanvas.height = 6;
    sampleCanvasRef.current = sampleCanvas;

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
        // VR Trigger press -> toggle play or handle VR HUD
        onTogglePlay();
      });

      controllers.push(controller);
      rayLines.push(line);
    }
    vrControllersRef.current = { controllers, controllerGrips: [], rayLines };

    // WebXR Session State Listeners
    renderer.xr.addEventListener('sessionstart', () => {
      setIsVRPresenting(true);
      camera.position.set(0, 1.4, 0);
    });

    renderer.xr.addEventListener('sessionend', () => {
      setIsVRPresenting(false);
      camera.position.set(0, 1.4, 0);
      cameraRotationRef.current = { yaw: 0, pitch: 0 };
    });

    // In-VR floating HUD setup
    const vrUICanvas = document.createElement('canvas');
    vrUICanvas.width = 512;
    vrUICanvas.height = 128;
    vrUICanvasRef.current = vrUICanvas;
    const vrUITexture = new THREE.CanvasTexture(vrUICanvas);
    vrUITextureRef.current = vrUITexture;

    const vrUIGeom = new THREE.PlaneGeometry(1.8, 0.45);
    const vrUIMat = new THREE.MeshBasicMaterial({
      map: vrUITexture,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    });
    const vrUIMesh = new THREE.Mesh(vrUIGeom, vrUIMat);
    vrUIMesh.position.set(0, 0.4, -2.2);
    vrUIMesh.rotation.x = -0.35;
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

    // Background pill container
    ctx.fillStyle = 'rgba(8, 12, 22, 0.88)';
    ctx.beginPath();
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 24);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Play/Pause icon indicator
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(isPlaying ? '⏸ PAUSE' : '▶ LECTURE', 40, 60);

    // Time text
    const formatTime = (sec: number) => {
      if (typeof sec !== 'number' || !isFinite(sec) || isNaN(sec) || sec < 0) return '0:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };
    const validCurrentTime = (typeof currentTime === 'number' && isFinite(currentTime) && currentTime >= 0) ? currentTime : 0;
    const validDuration = (typeof duration === 'number' && isFinite(duration) && duration > 0) ? duration : 0;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText(`${formatTime(validCurrentTime)} / ${formatTime(validDuration)}`, 180, 60);

    // Ambilight status indicator
    ctx.fillStyle = ambilightConfig.enabled ? '#38bdf8' : '#64748b';
    ctx.fillText(`AMBILIGHT: ${ambilightConfig.enabled ? 'ON' : 'OFF'}`, 330, 60);

    // Progress bar
    const barX = 40;
    const barY = 85;
    const barW = canvas.width - 80;
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
      const sCanvas = sampleCanvasRef.current;
      if (ctx && sCanvas) {
        const sCtx = sCanvas.getContext('2d');
        if (sCtx) {
          const glowAlpha = Math.min(1, 0.72 * ambilightConfig.intensity);
          const top = ambilightData.top || [];
          const bot = ambilightData.bottom || [];
          const left = ambilightData.left || [];
          const right = ambilightData.right || [];
          const dom = ambilightData.dominant || [20, 25, 35];

          // 1. Generate 8x6 continuous perimeter chromatic matrix (100% weighted by screen edges)
          const imgData = sCtx.createImageData(8, 6);
          const d = imgData.data;

          for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 8; x++) {
              const idx = (y * 8 + x) * 4;
              let col: [number, number, number];

              // Outer perimeter cells directly take their corresponding edge zone
              if (y === 0) {
                col = top[x] || dom;
              } else if (y === 5) {
                col = bot[x] || dom;
              } else if (x === 0) {
                col = left[y] || dom;
              } else if (x === 7) {
                col = right[y] || dom;
              } else {
                // Internal cells: power-weighted solely by proximity to the 4 edges
                // Completely eliminates center image pollution so edge colors stay pure and dominant!
                const dTop = y;
                const dBot = 5 - y;
                const dLeft = x;
                const dRight = 7 - x;

                // Inverse-distance power 2.4 gives strong authority to the closest edge
                const wTop = 1 / Math.pow(dTop + 0.35, 2.4);
                const wBot = 1 / Math.pow(dBot + 0.35, 2.4);
                const wLeft = 1 / Math.pow(dLeft + 0.35, 2.4);
                const wRight = 1 / Math.pow(dRight + 0.35, 2.4);

                const sumW = wTop + wBot + wLeft + wRight;

                const topCol = top[x] || dom;
                const botCol = bot[x] || dom;
                const leftCol = left[y] || dom;
                const rightCol = right[y] || dom;

                const r = (wTop * topCol[0] + wBot * botCol[0] + wLeft * leftCol[0] + wRight * rightCol[0]) / sumW;
                const g = (wTop * topCol[1] + wBot * botCol[1] + wLeft * leftCol[1] + wRight * rightCol[1]) / sumW;
                const b = (wTop * topCol[2] + wBot * botCol[2] + wLeft * leftCol[2] + wRight * rightCol[2]) / sumW;
                col = [r, g, b];
              }

              d[idx] = Math.max(0, Math.min(255, Math.round(col[0])));
              d[idx + 1] = Math.max(0, Math.min(255, Math.round(col[1])));
              d[idx + 2] = Math.max(0, Math.min(255, Math.round(col[2])));
              d[idx + 3] = Math.round(glowAlpha * 255);
            }
          }
          sCtx.putImageData(imgData, 0, 0);

          // 2. Render onto haloCanvas with full hardware bicubic upscaling + 48px Gaussian blur
          // This creates a pure liquid color field with ZERO grid, ZERO spokes, and ZERO rings
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.filter = 'blur(48px)';
          ctx.drawImage(sCanvas, 0, 0, canvas.width, canvas.height);
          ctx.filter = 'none';

          // 3. Smooth, gentle 16:9 widescreen elliptical vignette (only 4 stops - zero polar grid)
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1.0, cy / cx); // 16:9 widescreen oval matching TV aspect ratio
          ctx.globalCompositeOperation = 'destination-in';
          const vignette = ctx.createRadialGradient(0, 0, cx * 0.15, 0, 0, cx * 1.05);
          vignette.addColorStop(0.00, 'rgba(0, 0, 0, 1.0)');
          vignette.addColorStop(0.35, 'rgba(0, 0, 0, 0.85)');
          vignette.addColorStop(0.70, 'rgba(0, 0, 0, 0.35)');
          vignette.addColorStop(0.92, 'rgba(0, 0, 0, 0.08)');
          vignette.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');
          ctx.fillStyle = vignette;
          ctx.fillRect(-cx * 2, -cx * 2, cx * 4, cx * 4);
          ctx.restore();

          ctx.globalCompositeOperation = 'source-over';
          texture.needsUpdate = true;
        }
      }
    }

    // Dynamic 3D lights updating in Three.js around the perimeter (Edge-Empowered)
    const { ambient, top, bottom, left, right } = lightsRef.current;
    const mult = typeof ambilightConfig.intensity === 'number' && isFinite(ambilightConfig.intensity) ? ambilightConfig.intensity : 1;
    const wallReflect = typeof ambilightConfig.wallReflection === 'number' && isFinite(ambilightConfig.wallReflection) ? ambilightConfig.wallReflection : 0.7;

    // Ambient room color: neutral dark cinema velvet (so it never washes out or tints edge colors!)
    ambient.color.setHex(0x0a0f1d);
    ambient.intensity = 0.12 * mult;

    // Top Light (Empowered strictly by top edge zones)
    const topAvg = calcAvgColor(ambilightData.top);
    const [tR, tG, tB] = toSafeRgbFloat(topAvg);
    top.color.setRGB(tR, tG, tB);
    top.intensity = 3.6 * mult * wallReflect;

    // Bottom Light (Empowered strictly by bottom edge zones)
    const botAvg = calcAvgColor(ambilightData.bottom);
    const [bR, bG, bB] = toSafeRgbFloat(botAvg);
    bottom.color.setRGB(bR, bG, bB);
    bottom.intensity = 3.2 * mult * wallReflect;

    // Left Light (Empowered strictly by left edge zones)
    const leftAvg = calcAvgColor(ambilightData.left);
    const [lR, lG, lB] = toSafeRgbFloat(leftAvg);
    left.color.setRGB(lR, lG, lB);
    left.intensity = 3.2 * mult * wallReflect;

    // Right Light (Empowered strictly by right edge zones)
    const rightAvg = calcAvgColor(ambilightData.right);
    const [rR, rG, rB] = toSafeRgbFloat(rightAvg);
    right.color.setRGB(rR, rG, rB);
    right.intensity = 3.2 * mult * wallReflect;
  }, [ambilightData, ambilightConfig]);

  // WebXR Launch Function
  const handleLaunchVR = async () => {
    if (!rendererRef.current) return;
    try {
      const xr = (navigator as any).xr;
      if (xr) {
        const session = await xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        await rendererRef.current.xr.setSession(session);
        setIsVRPresenting(true);
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
      {/* VR Quick Status Overlay if WebXR ready */}
      {!isVRPresenting && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleRecenter}
            title="Recentrer la vue"
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 backdrop-blur-sm transition-colors text-xs flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Recentrer
          </button>

          {xrSupported && (
            <button
              onClick={handleLaunchVR}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-semibold rounded-lg shadow-lg shadow-amber-500/25 transition-all text-xs flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 7.28a3.5 3.5 0 0 0-3.5-3.5H6.5A3.5 3.5 0 0 0 3 7.28v9.44A3.5 3.5 0 0 0 6.5 20.22h11a3.5 3.5 0 0 0 3.5-3.5V7.28ZM7.5 13.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm9 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>
              </svg>
              Entrer en VR (Quest 3S)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
