/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VRCanvas } from './components/VRCanvas';
import { CinemaHUD } from './components/CinemaHUD';
import { VideoSelectorModal } from './components/VideoSelectorModal';
import { QuestGuideModal } from './components/QuestGuideModal';
import { AmbilightExtractor } from './utils/ambilightExtractor';
import {
  AmbilightConfig,
  AmbilightSampleData,
  EnvironmentType,
  ScreenConfig,
  VideoItem,
} from './types';

const INITIAL_VIDEO: VideoItem = {
  id: 'initial',
  title: 'Cinéma Virtuel LuminaVR',
  subtitle: 'Prêt pour la lecture de vos films & séries',
  category: 'Cinéma',
  aspectRatio: '16:9',
  description: 'Cliquez sur "Sélectionner un film" pour charger votre fichier local ou une URL.',
  url: '',
};

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const extractorRef = useRef<AmbilightExtractor>(new AmbilightExtractor());

  // Current Video
  const [currentVideo, setCurrentVideo] = useState<VideoItem>(INITIAL_VIDEO);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVRPresenting, setIsVRPresenting] = useState(false);

  // Modals
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Ambilight Configuration
  const [ambilightConfig, setAmbilightConfig] = useState<AmbilightConfig>({
    enabled: true,
    intensity: 1.25,
    spread: 1.8,
    saturation: 1.4,
    smoothing: 0.15,
    zones: 32,
    mode: 'theater',
    wallReflection: 0.7,
  });

  // Screen Ergonomics (Optimized for Meta Quest 3S)
  const [screenConfig, setScreenConfig] = useState<ScreenConfig>({
    curvature: 0.35, // 35% IMAX curve
    distance: 3.4,   // 3.4 meters
    size: 1.2,       // 120% scale
    heightOffset: 0.1,
    tilt: 0,         // 0° default, can tilt for bed mode
    format3D: '2d',
    aspectRatio: '16:9',
  });

  // Virtual Theater Environment
  const [environment, setEnvironment] = useState<EnvironmentType>('cinema');

  // Real-time Ambilight Sample Data
  const [ambilightData, setAmbilightData] = useState<AmbilightSampleData>({
    top: Array(8).fill([15, 18, 25]),
    bottom: Array(8).fill([15, 18, 25]),
    left: Array(6).fill([15, 18, 25]),
    right: Array(6).fill([15, 18, 25]),
    dominant: [20, 25, 35],
    averageBrightness: 0.2,
  });

  // Update handlers
  const handleUpdateAmbilight = useCallback((updates: Partial<AmbilightConfig>) => {
    setAmbilightConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleUpdateScreen = useCallback((updates: Partial<ScreenConfig>) => {
    setScreenConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Play / Pause toggle
  const handleTogglePlay = useCallback(() => {
    if (!currentVideo.url) {
      setIsVideoModalOpen(true);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback prevented:', err);
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [currentVideo.url]);

  // Seek handler
  const handleSeek = useCallback((percent: number) => {
    const video = videoRef.current;
    if (!video || isNaN(video.duration)) return;
    video.currentTime = percent * video.duration;
    setCurrentTime(video.currentTime);
  }, []);

  // Volume handler
  const handleVolumeChange = useCallback((newVol: number) => {
    const video = videoRef.current;
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (video) {
      video.volume = clamped;
    }
  }, []);

  // Select video
  const handleSelectVideo = useCallback((video: VideoItem) => {
    setCurrentVideo(video);
  }, []);

  // Synchronize and load video when currentVideo changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideo.url) return;

    setIsPlaying(false);
    setCurrentTime(0);

    video.volume = volume;
    video.muted = false;

    video.load();
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          // Autoplay restricted until direct user interaction
          console.log('Autoplay restriction (click to play):', err.name);
          setIsPlaying(false);
        });
    }
  }, [currentVideo.url, volume]);

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }, []);

  // WebXR Launch triggered from HUD
  const handleLaunchVR = useCallback(async () => {
    const xr = (navigator as any).xr;
    if (!xr) {
      alert("WebXR n'est pas disponible dans ce navigateur. Utilisez le navigateur Meta Quest Browser sur votre Meta Quest 3S.");
      return;
    }

    try {
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });
      // Handled inside Three.js renderer listener
      setIsVRPresenting(true);
    } catch (err: any) {
      alert("Impossible de démarrer la session VR : " + (err.message || 'Assurez-vous d\'être sur votre casque VR'));
    }
  }, []);

  // Ambilight Extraction Loop (runs continuously with requestVideoFrameCallback or rAF)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isSubscribed = true;
    let frameCallbackId: number | null = null;
    let animFrameId: number | null = null;

    const processFrame = () => {
      if (!isSubscribed) return;

      if (ambilightConfig.enabled && video.readyState >= 2 && !video.paused) {
        const data = extractorRef.current.extract(video, ambilightConfig);
        setAmbilightData(data);
      }

      if ('requestVideoFrameCallback' in video) {
        frameCallbackId = (video as any).requestVideoFrameCallback(processFrame);
      } else {
        animFrameId = requestAnimationFrame(processFrame);
      }
    };

    if ('requestVideoFrameCallback' in video) {
      frameCallbackId = (video as any).requestVideoFrameCallback(processFrame);
    } else {
      animFrameId = requestAnimationFrame(processFrame);
    }

    return () => {
      isSubscribed = false;
      if (frameCallbackId !== null && 'cancelVideoFrameCallback' in video) {
        (video as any).cancelVideoFrameCallback(frameCallbackId);
      }
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
    };
  }, [ambilightConfig]);

  // Video Element event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      video.volume = volume;
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [volume, currentVideo.title]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handleTogglePlay();
          break;
        case 'KeyF':
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case 'KeyA':
          e.preventDefault();
          handleUpdateAmbilight({ enabled: !ambilightConfig.enabled });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSeek(duration > 0 ? Math.max(0, currentTime - 10) / duration : 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSeek(duration > 0 ? Math.min(duration, currentTime + 10) / duration : 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'KeyV':
          e.preventDefault();
          handleLaunchVR();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleTogglePlay,
    handleToggleFullscreen,
    handleSeek,
    handleVolumeChange,
    handleLaunchVR,
    ambilightConfig.enabled,
    duration,
    currentTime,
    volume,
    handleUpdateAmbilight,
  ]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <main className="relative w-screen h-screen bg-[#020408] text-white overflow-hidden select-none font-sans">
      {/* Video Element rendered invisibly in layout to guarantee GPU frame updates */}
      <video
        ref={videoRef}
        src={currentVideo.url}
        crossOrigin={currentVideo.isLocal ? undefined : 'anonymous'}
        playsInline
        preload="auto"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '320px',
          height: '180px',
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: -999,
          transform: 'scale(0.01)',
          transformOrigin: 'bottom left',
        }}
      />

      {/* 3D WebGL / WebXR Viewport */}
      <VRCanvas
        videoRef={videoRef}
        currentVideo={currentVideo}
        ambilightConfig={ambilightConfig}
        screenConfig={screenConfig}
        environment={environment}
        ambilightData={ambilightData}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        currentTime={currentTime}
        duration={duration}
        onEnterVR={handleLaunchVR}
        isVRPresenting={isVRPresenting}
        setIsVRPresenting={setIsVRPresenting}
      />

      {/* Center Play Button Overlay when paused */}
      {!isPlaying && !isVideoModalOpen && !isGuideModalOpen && (
        <div
          onClick={handleTogglePlay}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer pointer-events-auto bg-black/20 backdrop-blur-[1px] transition-all"
        >
          <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-slate-900/85 border border-slate-700/60 shadow-2xl backdrop-blur-md transform transition hover:scale-105 active:scale-95 group">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 text-slate-950 group-hover:from-amber-400 group-hover:to-orange-400 transition-colors">
              <svg className="w-7 h-7 fill-current translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-white max-w-xs truncate">
                {currentVideo.url ? currentVideo.title : 'Sélectionner un film'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentVideo.url ? 'Cliquer pour lancer la lecture avec le son' : 'Cliquer pour charger un fichier vidéo (Quest / PC)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HUD Overlay with Cinema controls and Ambilight tuners */}
      <CinemaHUD
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        currentVideo={currentVideo}
        ambilightConfig={ambilightConfig}
        onUpdateAmbilight={handleUpdateAmbilight}
        screenConfig={screenConfig}
        onUpdateScreen={handleUpdateScreen}
        environment={environment}
        onChangeEnvironment={setEnvironment}
        ambilightData={ambilightData}
        onOpenVideoSelector={() => setIsVideoModalOpen(true)}
        onOpenQuestGuide={() => setIsGuideModalOpen(true)}
        onLaunchVR={handleLaunchVR}
        isVRPresenting={isVRPresenting}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Video Selection Modal (Local file, Streaming link) */}
      <VideoSelectorModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        currentVideo={currentVideo}
        onSelectVideo={handleSelectVideo}
      />

      {/* Meta Quest 3S Guide & Tips Modal */}
      <QuestGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </main>
  );
}
