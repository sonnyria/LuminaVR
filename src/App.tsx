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

// Default configurations
const DEFAULT_AMBILIGHT_CONFIG: AmbilightConfig = {
  enabled: true,
  intensity: 1.25,
  spread: 1.8,
  saturation: 1.4,
  smoothing: 0.15,
  zones: 32,
  mode: 'theater',
  wallReflection: 0.7,
  gradientSteps: 0,
};

const DEFAULT_SCREEN_CONFIG: ScreenConfig = {
  curvature: 0.35, // 35% IMAX curve
  distance: 3.4,   // 3.4 meters
  size: 1.2,       // 120% scale
  heightOffset: 0.1,
  tilt: 0,         // 0° default, can tilt for bed mode
  format3D: '2d',
  aspectRatio: '16:9',
};

const DEFAULT_ENVIRONMENT: EnvironmentType = 'cinema';

const STORAGE_KEYS = {
  AMBILIGHT: 'luminavr_ambilight_config',
  SCREEN: 'luminavr_screen_config',
  ENVIRONMENT: 'luminavr_environment',
  VOLUME: 'luminavr_volume',
};

function loadStoredConfig<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch (err) {
    console.warn(`Could not load settings for ${key}:`, err);
    return fallback;
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const extractorRef = useRef<AmbilightExtractor>(new AmbilightExtractor());
  const streamRef = useRef<MediaStream | null>(null);
  const streamWindowRef = useRef<Window | null>(null);

  // Current Video
  const [currentVideo, setCurrentVideo] = useState<VideoItem>(INITIAL_VIDEO);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isStreamMutedInLumina, setIsStreamMutedInLumina] = useState(false);
  const [volume, setVolume] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.VOLUME);
      if (stored !== null) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed;
      }
    } catch {}
    return 1;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVRPresenting, setIsVRPresenting] = useState(false);

  // Modals
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Ambilight Configuration (Persisted across sessions)
  const [ambilightConfig, setAmbilightConfig] = useState<AmbilightConfig>(() =>
    loadStoredConfig(STORAGE_KEYS.AMBILIGHT, DEFAULT_AMBILIGHT_CONFIG)
  );

  // Screen Ergonomics (Persisted across sessions)
  const [screenConfig, setScreenConfig] = useState<ScreenConfig>(() =>
    loadStoredConfig(STORAGE_KEYS.SCREEN, DEFAULT_SCREEN_CONFIG)
  );

  // Virtual Theater Environment (Persisted across sessions)
  const [environment, setEnvironment] = useState<EnvironmentType>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ENVIRONMENT);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (['cinema', 'void', 'lounge', 'cosmic'].includes(parsed)) return parsed;
      }
    } catch {}
    return DEFAULT_ENVIRONMENT;
  });

  // Auto-persist Ambilight configuration
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AMBILIGHT, JSON.stringify(ambilightConfig));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }, [ambilightConfig]);

  // Auto-persist Screen ergonomics
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCREEN, JSON.stringify(screenConfig));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }, [screenConfig]);

  // Auto-persist Environment
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, JSON.stringify(environment));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }, [environment]);

  // Auto-persist Volume
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VOLUME, JSON.stringify(volume));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }, [volume]);

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

  const handleResetAmbilight = useCallback(() => {
    setAmbilightConfig(DEFAULT_AMBILIGHT_CONFIG);
  }, []);

  const handleResetScreen = useCallback(() => {
    setScreenConfig(DEFAULT_SCREEN_CONFIG);
  }, []);

  // Play / Pause toggle
  const handleTogglePlay = useCallback(() => {
    if (!currentVideo.url && !currentVideo.isStream) {
      setIsVideoModalOpen(true);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback prevented, retrying muted:', err);
        video.muted = true;
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [currentVideo.url, currentVideo.isStream]);

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
    // If switching away from live stream, stop tracks
    if (streamRef.current && !video.isStream) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsStreamActive(false);
    }
    setCurrentVideo(video);
  }, []);

  // Start Browser Tab / Screen capture (YouTube, Netflix, Twitch, etc.)
  const handleStartTabCapture = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert("La capture de flux navigateur n'est pas supportée sur ce navigateur.");
        return;
      }

      // Stop previous stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Request screen/tab capture with audio enabled and suppressLocalAudioPlayback to mute the source tab
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            suppressLocalAudioPlayback: true,
          } as any,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
          });
        }
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        // Crucial: remove any src attribute so srcObject is never overridden by network loaders
        if (video.hasAttribute('src')) {
          video.removeAttribute('src');
        }
        video.srcObject = stream;

        // Ensure audio tracks are enabled and video is unmuted
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach((track) => {
            track.enabled = true;
          });
        }
        video.volume = volume > 0 ? volume : 1;
        video.muted = false;

        video.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('Playback error, retrying muted with interaction unmute:', err);
          video.muted = true;
          video.play().then(() => {
            setIsPlaying(true);
            const unmuteOnInteraction = () => {
              video.muted = false;
              video.volume = volume > 0 ? volume : 1;
              window.removeEventListener('click', unmuteOnInteraction);
            };
            window.addEventListener('click', unmuteOnInteraction, { once: true });
          }).catch(() => {});
        });
      }

      const videoTrack = stream.getVideoTracks()[0];
      const streamLabel = videoTrack?.label || 'Onglet Navigateur en direct';

      const streamItem: VideoItem = {
        id: `stream-${Date.now()}`,
        title: streamLabel.toLowerCase().includes('tab') || streamLabel.toLowerCase().includes('onglet')
          ? 'Navigateur Web (YouTube / Netflix / Stream)'
          : streamLabel,
        subtitle: 'Flux navigateur en direct avec Ambilight IMAX',
        category: 'Navigateur Web',
        aspectRatio: '16:9',
        isLocal: false,
        isStream: true,
        description: 'Diffusion temps réel de votre onglet ou fenêtre de streaming avec Ambilight 60 FPS.',
        url: '', // Left empty so React never applies a src attribute to the video tag
      };

      videoTrack.onended = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.removeAttribute('src');
        }
        streamRef.current = null;
        setIsStreamActive(false);
        setIsPlaying(false);
      };

      setCurrentVideo(streamItem);
      setIsStreamActive(true);
      setIsPlaying(true);
      setIsVideoModalOpen(false);
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Capture error:', err);
      }
    }
  }, [volume, isStreamMutedInLumina]);

  // Open YouTube/stream window and keep reference to focus later
  const handleOpenStreamWindow = useCallback((url: string = 'https://www.youtube.com') => {
    try {
      if (streamWindowRef.current && !streamWindowRef.current.closed) {
        streamWindowRef.current.focus();
      } else {
        const win = window.open(url, 'lumina_stream_window', 'width=1120,height=750,menubar=no,toolbar=no');
        streamWindowRef.current = win;
      }
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  // Bring back YouTube/source window to change video
  const handleFocusStreamTab = useCallback(() => {
    if (streamWindowRef.current && !streamWindowRef.current.closed) {
      streamWindowRef.current.focus();
    } else {
      handleOpenStreamWindow('https://www.youtube.com');
    }
  }, [handleOpenStreamWindow]);

  // Toggle Anti-Echo audio mute (Direct YouTube sound vs LuminaVR sound)
  const handleToggleStreamAudioMute = useCallback(() => {
    setIsStreamMutedInLumina((prev) => {
      const next = !prev;
      if (videoRef.current && currentVideo.isStream) {
        videoRef.current.muted = next;
      }
      return next;
    });
  }, [currentVideo.isStream]);

  // Stop Browser Tab capture
  const handleStopTabCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreamActive(false);
    setIsPlaying(false);
  }, []);

  // Synchronize and load video when currentVideo changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (currentVideo.isStream) {
      video.removeAttribute('src');
      return;
    }
    if (!currentVideo.url) return;

    // Clear any previous media stream
    if (video.srcObject) {
      video.srcObject = null;
    }

    setIsPlaying(false);
    setCurrentTime(0);

    video.src = currentVideo.url;
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
          console.log('Autoplay restriction (click to play):', err.name);
          setIsPlaying(false);
        });
    }
  }, [currentVideo.url, currentVideo.isStream, volume]);

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

  // Ambilight Extraction Loop (runs continuously with requestVideoFrameCallback or rAF)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isSubscribed = true;
    let frameCallbackId: number | null = null;
    let animFrameId: number | null = null;

    const processFrame = () => {
      if (!isSubscribed) return;

      if (ambilightConfig.enabled && (video.readyState >= 2 || video.videoWidth > 0) && !video.paused) {
        const data = extractorRef.current.extract(video, ambilightConfig);
        setAmbilightData(data);
      }

      animFrameId = requestAnimationFrame(processFrame);
    };

    animFrameId = requestAnimationFrame(processFrame);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleTogglePlay,
    handleToggleFullscreen,
    handleSeek,
    handleVolumeChange,
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
      {/* Video Element: must not be occluded by parent background */}
      <video
        ref={videoRef}
        src={currentVideo.isStream ? undefined : (currentVideo.url || undefined)}
        crossOrigin={currentVideo.isStream || currentVideo.isLocal ? undefined : 'anonymous'}
        playsInline
        autoPlay
        preload="auto"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '8px',
          height: '8px',
          opacity: 0.05,
          zIndex: 1,
          pointerEvents: 'none',
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
                {currentVideo.url || currentVideo.isStream ? currentVideo.title : 'Sélectionner un film'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentVideo.url || currentVideo.isStream ? 'Cliquer pour lancer la lecture avec le son' : 'Cliquer pour charger un fichier vidéo (Quest / PC)'}
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
        onResetAmbilight={handleResetAmbilight}
        screenConfig={screenConfig}
        onUpdateScreen={handleUpdateScreen}
        onResetScreen={handleResetScreen}
        environment={environment}
        onChangeEnvironment={setEnvironment}
        ambilightData={ambilightData}
        onOpenVideoSelector={() => setIsVideoModalOpen(true)}
        onOpenQuestGuide={() => setIsGuideModalOpen(true)}
        isVRPresenting={isVRPresenting}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onFocusStreamTab={handleFocusStreamTab}
        onToggleStreamAudioMute={handleToggleStreamAudioMute}
        isStreamMutedInLumina={isStreamMutedInLumina}
        onStopStream={handleStopTabCapture}
      />

      {/* Video Selection Modal (Local file, Streaming link, Browser tab capture) */}
      <VideoSelectorModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        currentVideo={currentVideo}
        onSelectVideo={handleSelectVideo}
        onStartTabCapture={handleStartTabCapture}
        onStopTabCapture={handleStopTabCapture}
        isStreamActive={isStreamActive}
        onOpenStreamWindow={handleOpenStreamWindow}
      />

      {/* Meta Quest 3S Guide & Tips Modal */}
      <QuestGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </main>
  );
}
