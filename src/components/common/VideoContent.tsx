import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Play, Pause, Volume2, VolumeX, RotateCcw, X } from 'lucide-react'

export interface VideoScene { id: string; label: string; content: ReactNode }

/**
 * VideoContent — self-contained video / tutorial player for NetForge.
 * Supports HTML5 <video> src OR a "keyframe scene" mode when no video file
 * is available but the player UX is still desired.
 */
export function VideoContent({
  title, description, poster, src, scenes, onClose,
}: {
  title: string
  description?: string
  poster?: string
  src?: string
  scenes?: VideoScene[]
  onClose?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [ct, setCt] = useState(0)
  const [dur, setDur] = useState(0)
  const [sceneIdx, setSceneIdx] = useState(0)
  // Keyframe-mode playback clock: milliseconds elapsed inside the current scene.
  const [sceneMs, setSceneMs] = useState(0)
  const isKeyframe = !src && !!scenes && scenes.length > 0
  const SCENE_MS = 5000

  // Keyframe "playback": a 100ms tick advances the in-scene clock and
  // auto-advances scenes, so Play/Pause actually does something visible.
  useEffect(() => {
    if (!isKeyframe || !playing) return
    const id = window.setInterval(() => {
      setSceneMs((ms) => {
        const next = ms + 100
        if (next < SCENE_MS) return next
        // Scene finished — move to the next one, or stop at the end.
        setSceneIdx((i) => {
          if (i + 1 < (scenes?.length ?? 0)) return i + 1
          setPlaying(false)
          return i
        })
        return 0
      })
    }, 100)
    return () => window.clearInterval(id)
  }, [isKeyframe, playing, scenes?.length])

  const togglePlay = () => {
    if (isKeyframe) {
      setPlaying((p) => {
        // Restart from the beginning when Play is pressed after finishing.
        if (!p && scenes && sceneIdx === scenes.length - 1 && sceneMs >= SCENE_MS - 100) {
          setSceneIdx(0)
          setSceneMs(0)
        }
        return !p
      })
      return
    }
    const v = videoRef.current
    if (!v) return
    v.paused ? void v.play() : v.pause()
  }
  const restart = () => {
    if (isKeyframe) { setSceneIdx(0); setSceneMs(0); setPlaying(true); return }
    if (videoRef.current) videoRef.current.currentTime = 0
  }
  const gotoScene = (i: number) => {
    if (!isKeyframe) return
    setSceneIdx(i)
    setSceneMs(0)
  }
  const toggleMute = () => {
    if (isKeyframe) { setMuted((m) => !m); return }
    const v = videoRef.current
    if (v) { v.muted = !v.muted; setMuted(v.muted) }
  }

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center gap-2">
        <span className="text-[var(--text-secondary)]">{title}</span>
        {description && (
          <span className="ml-2 text-[10px] font-normal normal-case text-[var(--text-dim)]">
            {description}
          </span>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="ml-auto rounded p-1 text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden bg-[var(--bg-inset)]">
        {src ? (
          <video ref={videoRef} className="h-full w-full object-contain" poster={poster} muted={muted}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCt(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}>
            <source src={src} />
          </video>
        ) : isKeyframe && scenes ? (
          <div key={sceneIdx} className="view-enter flex h-full w-full items-center justify-center p-6">
            <div className="w-full max-w-2xl text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
                Scene {sceneIdx + 1} / {scenes.length}
              </div>
              <div className="mt-1 text-[14px] font-bold text-[var(--text-primary)]">
                {scenes[sceneIdx].label}
              </div>
              <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {scenes[sceneIdx].content}
              </div>
              <div className="mt-3 flex justify-center gap-1.5">
                {scenes.map((s, i) => (
                  <button key={s.id} type="button" onClick={() => gotoScene(i)}
                    aria-label={`Go to scene ${i + 1}: ${s.label}`}
                    className={`h-2 w-6 rounded transition-colors ${
                      i === sceneIdx ? 'bg-[var(--accent-link)]'
                        : 'bg-[var(--border-bright)] hover:bg-[var(--accent-link)]/40'
                    }`} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center"
            style={{ background: poster ? `url(${poster}) center/cover`
              : 'linear-gradient(135deg, var(--bg-inset) 0%, var(--bg-elevated) 100%)' }}>
            <div className="text-center text-[var(--text-dim)]">
              <Play className="mx-auto h-12 w-12 opacity-30" />
              <div className="mt-2 text-[11px]">No media loaded</div>
            </div>
          </div>
        )}
        {!playing && (
          <button type="button" onClick={togglePlay} aria-label="Play"
            className="absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity hover:bg-black/20">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-panel)]/90 shadow-lg ring-1 ring-[var(--border-bright)] hover-scale">
              <Play className="h-6 w-6 text-[var(--accent-link)]" />
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5">
        <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}
          className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]">
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={restart} aria-label="Restart"
          className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        {!isKeyframe && (
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]">
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        )}
        {(src ? dur > 0 : isKeyframe) && (
          <div className="mx-2 flex-1">
            <div className="h-1 overflow-hidden rounded bg-[var(--bg-inset)]">
              <div className="h-full bg-[var(--accent-link)] transition-[width] duration-100 ease-linear"
                style={src
                  ? { width: `${(ct / dur) * 100}%` }
                  : { width: `${(((sceneIdx * SCENE_MS) + Math.min(sceneMs, SCENE_MS)) / ((scenes?.length ?? 1) * SCENE_MS)) * 100}%` }} />
            </div>
          </div>
        )}
        <span className="font-data text-[10px] text-[var(--text-dim)]">
          {src ? `${Math.floor(ct)}s / ${Math.floor(dur)}s`
            : isKeyframe && scenes
              ? `${Math.floor(((sceneIdx * SCENE_MS) + Math.min(sceneMs, SCENE_MS)) / 1000)}s / ${Math.floor((scenes.length * SCENE_MS) / 1000)}s`
              : '0:00'}
        </span>
      </div>
    </div>
  )
}

