import { Suspense, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Grid, Html, OrbitControls, RoundedBox } from '@react-three/drei'
import { Cable, Check, ChevronLeft, RotateCcw, Zap } from 'lucide-react'
import { useDeviceLabStore } from '@/store/deviceLabStore'
import { evalGoal, faceNormal, findBench, portWorld } from '@/devicelab/hardwareBench'
import type { BenchNode, BenchPort } from '@/devicelab/hardwareBench'
import { celebrateLab } from '@/lib/celebrate'

interface Cbl {
  from: string
  to: string
  cable?: 'power' | 'data'
}

/** Order-independent equality for a cable's two endpoints. */
function sameCable(x: { from: string; to: string }, y: { from: string; to: string }): boolean {
  return (x.from === y.from && x.to === y.to) || (x.from === y.to && x.to === y.from)
}

type PortState = 'idle' | 'connected' | 'armed' | 'live'

const DEVICE_COLOR: Record<string, string> = {
  outlet: '#6b7488',
  modem: '#5a6270',
  router: '#5c6a92',
  switch: '#4d7aa8',
  laptop: '#6a7488',
  desktop: '#5b6478',
  pc: '#5b6478',
  accesspoint: '#4f7f9e',
  printer: '#6b7280',
  phone: '#67707f',
}

/** Stand a plug/label a touch off the box face. */
function standoff(base: [number, number, number], face: BenchPort['face'], by: number): [number, number, number] {
  const n = faceNormal(face)
  return [base[0] + n[0] * by, base[1] + n[1] * by, base[2] + n[2] * by]
}

/* ── one device ───────────────────────────────────────────────────────── */

function Device({ node, powered, booting }: { node: BenchNode; powered: boolean; booting: boolean }): ReactElement {
  const led = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (!led.current) return
    const target = booting ? Math.sin(clock.elapsedTime * 9) * 0.5 + 0.5 : powered ? 1 : 0
    led.current.emissiveIntensity += (0.15 + target * 1.7 - led.current.emissiveIntensity) * 0.2
  })

  const [w, h, d] = node.size
  const hasLed =
    node.icon === 'router' ||
    node.icon === 'switch' ||
    node.icon === 'modem' ||
    node.icon === 'accesspoint'

  return (
    <group position={[node.pos[0], 0, node.pos[1]]}>
      <RoundedBox
        args={[w, h, d]}
        radius={Math.min(0.07, h / 2 - 0.01)}
        smoothness={4}
        position={[0, h / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={DEVICE_COLOR[node.icon]} roughness={0.42} metalness={0.25} />
      </RoundedBox>

      {hasLed && (
        <mesh position={[-w / 2 + 0.28, h + 0.02, d / 2 - 0.22]}>
          <sphereGeometry args={[0.05, 14, 14]} />
          <meshStandardMaterial ref={led} color="#39d98a" emissive="#39d98a" emissiveIntensity={0.15} toneMapped={false} />
        </mesh>
      )}

      {node.icon === 'router' &&
        [-w / 2 + 0.25, w / 2 - 0.25].map((x, i) => (
          <mesh key={i} position={[x, h + 0.34, -d / 2 + 0.12]} rotation={[0.28, 0, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.68, 8]} />
            <meshStandardMaterial color="#1a1e27" roughness={0.7} />
          </mesh>
        ))}

      {node.icon === 'switch' &&
        Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[-w / 2 + 0.4 + i * 0.26, h * 0.45, d / 2 + 0.001]}>
            <planeGeometry args={[0.15, 0.15]} />
            <meshStandardMaterial color="#0c0f16" roughness={0.9} />
          </mesh>
        ))}

      {node.icon === 'outlet' &&
        [0.26, -0.26].map((z, i) => (
          <mesh key={i} position={[w / 2 + 0.001, h * 0.5, z]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.16, 0.3]} />
            <meshStandardMaterial color="#0c0f16" roughness={0.9} />
          </mesh>
        ))}

      {node.icon === 'desktop' &&
        [0, 1, 2].map((i) => (
          <mesh key={i} position={[0, h - 0.28 - i * 0.22, d / 2 + 0.001]}>
            <planeGeometry args={[w * 0.5, 0.05]} />
            <meshStandardMaterial color="#0c0f16" roughness={0.9} />
          </mesh>
        ))}

      {node.icon === 'laptop' && (
        <group position={[0, h, -d / 2 + 0.03]} rotation={[-0.32, 0, 0]}>
          <RoundedBox args={[w * 0.97, 0.92, 0.05]} radius={0.03} smoothness={3} position={[0, 0.46, 0]} castShadow>
            <meshStandardMaterial color="#20242e" roughness={0.5} />
          </RoundedBox>
          <mesh position={[0, 0.46, 0.031]}>
            <planeGeometry args={[w * 0.86, 0.74]} />
            <meshStandardMaterial color="#1b2b47" emissive="#1b2b47" emissiveIntensity={0.5} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/* ── one port ─────────────────────────────────────────────────────────── */

function Port({
  node,
  port,
  state,
  hint,
  onSelect,
}: {
  node: BenchNode
  port: BenchPort
  state: PortState
  hint: boolean
  onSelect: () => void
}): ReactElement {
  const [hover, setHover] = useState(false)
  const ring = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const pos = standoff(portWorld(node, port), port.face, 0.14)
  const isPower = port.kind === 'power'
  const showHint = hint && state === 'idle' && !hover

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ring.current) {
      const s = 1 + (showHint ? Math.sin(t * 4) * 0.18 + 0.35 : 0)
      ring.current.scale.setScalar(s)
      ring.current.visible = showHint
      const rm = ring.current.material as THREE.MeshBasicMaterial
      rm.opacity = showHint ? 0.45 + Math.sin(t * 4) * 0.25 : 0
    }
    if (mat.current && showHint) {
      mat.current.emissiveIntensity = 0.6 + Math.sin(t * 4) * 0.4
    }
  })

  const color =
    state === 'live'
      ? '#39d98a'
      : state === 'armed'
        ? '#e0a33e'
        : state === 'connected'
          ? '#7b6cff'
          : showHint
            ? '#f0b74e'
            : '#c2c9d8'
  const emissive =
    state === 'live' ? '#39d98a' : state === 'armed' || showHint ? '#e0a33e' : hover ? '#7b6cff' : '#000000'
  const emissiveIntensity = state === 'live' ? 1.5 : state === 'armed' ? 1 : hover ? 0.7 : 0
  const grow = showHint ? 1.35 : 1

  return (
    <group position={pos}>
      {/* generous invisible hit target - the visible plug is small */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh
        ref={ring}
        visible={false}
        raycast={() => null}
        rotation={port.face === 'left' || port.face === 'right' ? [0, Math.PI / 2, 0] : port.face === 'top' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
      >
        <torusGeometry args={[0.18, 0.028, 8, 24]} />
        <meshBasicMaterial color="#e0a33e" transparent opacity={0} toneMapped={false} />
      </mesh>

      <mesh scale={hover ? grow * 1.3 : grow} castShadow raycast={() => null}>
        {isPower ? <cylinderGeometry args={[0.1, 0.1, 0.13, 16]} /> : <boxGeometry args={[0.24, 0.19, 0.14]} />}
        <meshStandardMaterial
          ref={mat}
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.4}
          metalness={0.35}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/* ── one cable ────────────────────────────────────────────────────────── */

function CableTube({
  a,
  b,
  kind,
  faulty,
  removable,
  onClick,
}: {
  a: [number, number, number]
  b: [number, number, number]
  kind?: 'power' | 'data'
  /** Troubleshooting: this cable is the one the current step wants unplugged. */
  faulty?: boolean
  /** Free-build mode: any cable can be clicked to remove it (no red glow). */
  removable?: boolean
  onClick?: () => void
}): ReactElement {
  const [hover, setHover] = useState(false)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const curve = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const mid = va.clone().lerp(vb, 0.5)
    const dist = va.distanceTo(vb)
    mid.y = Math.max(0.08, Math.min(va.y, vb.y) - 0.22 - dist * 0.13)
    return new THREE.QuadraticBezierCurve3(va, mid, vb)
  }, [a, b])

  useFrame(({ clock }) => {
    if (!mat.current) return
    const pulse = faulty ? 0.5 + Math.sin(clock.elapsedTime * 5) * 0.4 : 0
    mat.current.emissiveIntensity += (pulse - mat.current.emissiveIntensity) * 0.2
  })

  const baseColor = kind === 'power' ? '#e0a33e' : '#6f7dff'
  const interactive = faulty || removable
  return (
    <mesh
      castShadow
      onPointerOver={interactive ? (e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' } : undefined}
      onPointerOut={interactive ? () => { setHover(false); document.body.style.cursor = '' } : undefined}
      onClick={interactive && onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
    >
      <tubeGeometry args={[curve, 44, kind === 'power' ? 0.05 : (faulty ? 0.055 : 0.043), 10, false]} />
      <meshStandardMaterial
        ref={mat}
        color={faulty ? (hover ? '#ff8a8a' : '#ff5d5d') : hover && removable ? '#9aa6ff' : baseColor}
        emissive={faulty ? '#ff5d5d' : '#000000'}
        emissiveIntensity={0}
        roughness={0.5}
        metalness={0.1}
        toneMapped={!faulty}
      />
    </mesh>
  )
}

/* ── the scene ────────────────────────────────────────────────────────── */

interface SceneProps {
  bench: NonNullable<ReturnType<typeof findBench>>
  cables: Cbl[]
  connectedIds: Set<string>
  poweredIds: Set<string>
  booting: string | null
  armed: string | null
  /** Ports the current step is asking the player to touch - the only ones we label. */
  hintIds: Set<string>
  /** Troubleshooting: the mis-cabled link the current step wants unplugged. */
  faultyCable: Cbl | null
  /** Free-build mode: every cable can be clicked to remove it. */
  goalMode: boolean
  portState: (id: string) => PortState
  onPortClick: (id: string) => void
  onPower: (node: BenchNode) => void
  onRemoveCable: (c: Cbl) => void
}

function BenchScene({ bench, cables, connectedIds, poweredIds, booting, hintIds, faultyCable, goalMode, portState, onPortClick, onPower, onRemoveCable }: SceneProps): ReactElement {
  const portIndex = useMemo(() => {
    const m: Record<string, { node: BenchNode; port: BenchPort }> = {}
    for (const n of bench.nodes) for (const p of n.ports) m[p.id] = { node: n, port: p }
    return m
  }, [bench])

  const endpoint = (id: string): [number, number, number] => {
    const e = portIndex[id]
    return standoff(portWorld(e.node, e.port), e.port.face, 0.14)
  }

  return (
    <>
      <color attach="background" args={['#111521']} />
      <fog attach="fog" args={['#111521', 18, 40]} />
      <hemisphereLight intensity={0.85} groundColor="#1a1f2e" color="#dfe6f5" />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 5]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-9, 9, 9, -9, 0.1, 32]} />
      </directionalLight>
      <directionalLight position={[-7, 5, -4]} intensity={0.5} color="#9fb4e0" />

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[60, 44]} />
        <meshStandardMaterial color="#1d2331" roughness={0.9} />
      </mesh>
      <Grid
        args={[60, 44]}
        cellSize={0.6}
        cellThickness={0.7}
        cellColor="#2f3849"
        sectionSize={3}
        sectionThickness={1.1}
        sectionColor="#465268"
        fadeDistance={34}
        fadeStrength={1.4}
        followCamera={false}
      />
      <ContactShadows position={[0, 0.01, 0]} scale={24} blur={2.4} far={7} opacity={0.5} />

      {bench.nodes.map((n) => (
        <Device key={n.id} node={n} powered={poweredIds.has(n.id)} booting={booting === n.id} />
      ))}

      {bench.nodes.flatMap((n) =>
        n.ports.map((p) => (
          <Port
            key={p.id}
            node={n}
            port={p}
            state={portState(p.id)}
            hint={hintIds.has(p.id)}
            onSelect={() => onPortClick(p.id)}
          />
        )),
      )}

      {cables.map((c, i) => (
        <CableTube
          key={i}
          a={endpoint(c.from)}
          b={endpoint(c.to)}
          kind={c.cable}
          faulty={!!faultyCable && sameCable(faultyCable, c)}
          removable={goalMode}
          onClick={() => onRemoveCable(c)}
        />
      ))}

      {bench.nodes
        .filter((n) => n.needsPower)
        .map((n) => {
          const on = poweredIds.has(n.id)
          const boot = booting === n.id
          return (
            <Html
              key={n.id}
              position={[n.pos[0] + 0.9, n.size[1] + 0.9, n.pos[1] + 0.2]}
              center
              distanceFactor={7}
              zIndexRange={[20, 0]}
            >
              <button
                type="button"
                className={`bench-power-btn ${on ? 'is-on' : ''} ${boot ? 'is-booting' : ''}`}
                disabled={on || boot}
                onClick={() => onPower(n)}
              >
                {on ? 'Powered on' : boot ? 'Booting…' : 'Power on'}
              </button>
            </Html>
          )
        })}

      {bench.nodes.flatMap((n) =>
        n.ports
          .filter((p) => hintIds.has(p.id) && !connectedIds.has(p.id))
          .map((p) => {
            const tag = standoff(portWorld(n, p), p.face, 0.55)
            return (
              <Html
                key={p.id}
                position={[tag[0], tag[1] + 0.55, tag[2]]}
                center
                distanceFactor={8}
                style={{ pointerEvents: 'none' }}
                zIndexRange={[15, 0]}
              >
                <span className="bench-port-tag is-hint">{p.label}</span>
              </Html>
            )
          }),
      )}

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4}
        maxDistance={20}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.2}
        target={[0.3, 0.35, -0.4]}
      />
    </>
  )
}

/* ── the lab ──────────────────────────────────────────────────────────── */

export function HardwareBench({ benchId, onBack }: { benchId: string; onBack: () => void }): ReactElement | null {
  const bench = findBench(benchId)
  const completeBench = useDeviceLabStore((s) => s.completeBench)

  const [cables, setCables] = useState<Cbl[]>(() => bench?.initialCables?.map((c) => ({ ...c })) ?? [])
  const [powered, setPowered] = useState<Set<string>>(() => new Set(bench?.initialPowered ?? []))
  const [booting, setBooting] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const portLabels = useMemo(() => {
    const m: Record<string, string> = {}
    if (bench) for (const n of bench.nodes) for (const p of n.ports) m[p.id] = p.label
    return m
  }, [bench])

  if (!bench) return null

  const isGoal = !!bench.goal
  const goalRows = isGoal ? evalGoal(bench, cables, powered) : []
  const goalDone = goalRows.length > 0 && goalRows.every((r) => r.ok)

  const step = bench.steps[stepIndex]
  const connectedIds = new Set<string>(cables.flatMap((c) => [c.from, c.to]))
  const hintIds = new Set<string>(
    !done && step?.type === 'connect' && step.from && step.to ? [step.from, step.to] : [],
  )
  const faultyCable: Cbl | null =
    !done && step?.type === 'fix-remove' && step.from && step.to
      ? { from: step.from, to: step.to }
      : null
  const nodePowered = (nodeId: string) => {
    const n = bench.nodes.find((x) => x.id === nodeId)
    return !n?.needsPower || powered.has(nodeId)
  }

  const portState = (id: string): PortState => {
    if (armed === id) return 'armed'
    const cable = cables.find((c) => c.from === id || c.to === id)
    if (!cable) return 'idle'
    if (cable.cable === 'power') return 'connected'
    const other = cable.from === id ? cable.to : cable.from
    const bench2 = bench
    const nodeOf = (pid: string) => bench2.nodes.find((n) => n.ports.some((p) => p.id === pid))?.id ?? ''
    return nodePowered(nodeOf(id)) && nodePowered(nodeOf(other)) ? 'live' : 'connected'
  }

  const reset = () => {
    setCables(bench.initialCables?.map((c) => ({ ...c })) ?? [])
    setPowered(new Set(bench.initialPowered ?? []))
    setBooting(null)
    setArmed(null)
    setStepIndex(0)
    setFeedback(null)
    setDone(false)
  }

  const finish = () => {
    setDone(true)
    completeBench(bench.id)
    celebrateLab()
    import('@/lib/audioEngine').then((m) => m.playTaskComplete()).catch(() => {})
  }

  const advance = () => {
    setFeedback(null)
    if (stepIndex + 1 >= bench.steps.length) finish()
    else setStepIndex((i) => i + 1)
  }

  /** Kind of a port id from the bench definition (for guessing power vs data). */
  const kindOf = (id: string) =>
    bench.nodes.flatMap((n) => n.ports).find((p) => p.id === id)?.kind

  const attempt = (a: string, b: string) => {
    if (cables.some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a))) {
      setFeedback('Those two are already cabled together.')
      return
    }
    if (isGoal) {
      // Free build: any port pair makes a cable, no ordering.
      const isPower = kindOf(a) === 'power' || kindOf(b) === 'power'
      setCables((prev) => [...prev, { from: a, to: b, cable: isPower ? 'power' : 'data' }])
      setFeedback(null)
      return
    }
    if (step.type === 'connect' && ((step.from === a && step.to === b) || (step.from === b && step.to === a))) {
      setCables((prev) => [...prev, { from: step.from!, to: step.to!, cable: step.cable }])
      advance()
      return
    }
    setFeedback(`That is not the cable this step needs. You tried ${portLabels[a] ?? a} → ${portLabels[b] ?? b}.`)
  }

  const removeCable = (c: Cbl) => {
    if (done || booting) return
    if (isGoal) {
      setCables((prev) => prev.filter((x) => !sameCable(x, c)))
      setFeedback(null)
      return
    }
    if (step?.type === 'fix-remove' && step.from && step.to && sameCable({ from: step.from, to: step.to }, c)) {
      setCables((prev) => prev.filter((x) => !sameCable(x, c)))
      advance()
    } else {
      setFeedback('That cable is not the fault this step is describing. Keep inspecting.')
    }
  }

  const clickPort = (portId: string) => {
    if (done || booting) return
    setFeedback(null)
    if (!armed) {
      setArmed(portId)
      return
    }
    if (armed === portId) {
      setArmed(null)
      return
    }
    attempt(armed, portId)
    setArmed(null)
  }

  const pressPower = (node: BenchNode) => {
    if (done || booting || powered.has(node.id)) return
    const powerPort = node.ports.find((p) => p.kind === 'power')
    const wired = powerPort && cables.some((c) => c.from === powerPort.id || c.to === powerPort.id)
    if (!wired) {
      setFeedback(`Plug ${node.label}'s power cable into the wall outlet first.`)
      return
    }
    setBooting(node.id)
    setFeedback(null)
    window.setTimeout(() => {
      setPowered((prev) => new Set(prev).add(node.id))
      setBooting((cur) => (cur === node.id ? null : cur))
      setStepIndex((idx) => {
        const s = bench.steps[idx]
        if (s?.type === 'power' && s.target === node.id) {
          if (idx + 1 >= bench.steps.length) {
            finish()
            return idx
          }
          return idx + 1
        }
        return idx
      })
    }, 1200)
  }

  return (
    <div className="bench-root view-enter">
      <div className="bench-header">
        <button type="button" onClick={onBack} className="explorer-back" aria-label="Back to Device Lab">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="bench-header-tag">{bench.title}</span>
        <span className="bench-progress">
          {isGoal
            ? `${goalRows.filter((r) => r.ok).length} / ${goalRows.length} goals`
            : `${done ? bench.steps.length : stepIndex} / ${bench.steps.length} steps`}
        </span>
        <button type="button" onClick={reset} className="bench-reset" aria-label="Start over">
          <RotateCcw className="h-3.5 w-3.5" />
          Start over
        </button>
      </div>

      <div className="bench-body">
        <div className="bench-stage-wrap">
          <div className="bench-stage-top">
            <Cable className="h-4 w-4 text-[var(--accent-link)]" />
            <span className="text-[12px] font-semibold text-[var(--text-primary)]">
              {armed
                ? 'Now click the other end of the cable'
                : step?.type === 'fix-remove'
                  ? 'Click the glowing red cable to unplug it'
                  : isGoal
                    ? 'Cable and power freely · click a port then its partner · click a cable to remove it'
                    : 'Click a port, then click where the cable plugs in'}
            </span>
            <span className="ml-auto text-[10.5px] text-[var(--text-dim)]">drag to orbit · scroll to zoom</span>
          </div>

          <div className="bench-stage">
            <Canvas shadows dpr={[1, 2]} camera={{ position: [6.5, 5.5, 7.8], fov: 46 }}>
              <Suspense fallback={null}>
                <BenchScene
                  bench={bench}
                  cables={cables}
                  connectedIds={connectedIds}
                  poweredIds={powered}
                  booting={booting}
                  armed={armed}
                  hintIds={hintIds}
                  faultyCable={faultyCable}
                  goalMode={isGoal && !done}
                  portState={portState}
                  onPortClick={clickPort}
                  onPower={pressPower}
                  onRemoveCable={removeCable}
                />
              </Suspense>
            </Canvas>
          </div>

          {feedback && (
            <div className="bench-feedback">
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}
        </div>

        <aside className="bench-panel">
          {done ? (
            <div className="bench-complete">
              <div className="bench-complete-badge">
                <Check className="h-7 w-7 text-[var(--status-up)]" />
              </div>
              <div className="text-[14px] font-bold text-[var(--text-primary)]">{bench.title} — wired up</div>
              <p className="text-[12px] leading-snug text-[var(--text-secondary)]">{bench.outro}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={reset} className="bench-cta-secondary">
                  Do it again
                </button>
                <button type="button" onClick={onBack} className="bench-cta-primary">
                  Back to Device Lab
                </button>
              </div>
            </div>
          ) : isGoal ? (
            <>
              <div className="bench-step-tag">Free build · meet the goal</div>
              <p className="bench-step-instruction">{bench.goal!.brief}</p>
              <ol className="bench-steplist">
                {goalRows.map((r) => (
                  <li key={r.label} className={`bench-steplist-item${r.ok ? ' is-done' : ''}`}>
                    <span className="bench-steplist-mark">
                      {r.ok ? <Check className="h-3 w-3" /> : '○'}
                    </span>
                    {r.label}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() =>
                  goalDone
                    ? finish()
                    : setFeedback(
                        `${goalRows.filter((r) => !r.ok).length} requirement(s) still unmet - check the list.`,
                      )
                }
                className={goalDone ? 'bench-cta-primary mt-3 w-full' : 'bench-cta-secondary mt-3 w-full'}
              >
                {goalDone ? 'Complete build ✓' : 'Check network'}
              </button>
            </>
          ) : (
            <>
              {bench.symptom && (
                <div className="mb-3 border-l-2 border-[var(--status-down)] bg-[color-mix(in_srgb,var(--status-down)_8%,transparent)] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--status-down)]">
                    Reported fault
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">
                    {bench.symptom}
                  </p>
                </div>
              )}
              <div className="bench-step-tag">
                Step {stepIndex + 1} of {bench.steps.length}
              </div>
              <h2 className="bench-step-title">{step.title}</h2>
              <p className="bench-step-instruction">{step.instruction}</p>
              <div className="bench-why">
                <div className="bench-why-label">Why this matters</div>
                <p className="bench-why-text">{step.why}</p>
              </div>
              <ol className="bench-steplist">
                {bench.steps.map((s, i) => (
                  <li
                    key={s.id}
                    className={`bench-steplist-item${i < stepIndex ? ' is-done' : ''}${i === stepIndex ? ' is-current' : ''}`}
                  >
                    <span className="bench-steplist-mark">{i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}</span>
                    {s.title}
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
