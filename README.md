# NetForge

**A network that agents can actually debug.**

NetForge is an interactive networking lab environment built for learning, troubleshooting, and AI-assisted network debugging. It combines a live network simulator, an interactive topology canvas, and an AI copilot to create a realistic hands-on networking experience.

## What It Does

NetForge simulates a small enterprise network with PCs, switches, routers, and servers. You can inspect devices, run real network commands (ping, traceroute, show ip route, show arp), wire devices together, and diagnose connectivity problems. An AI copilot can analyze the live topology, explain what's wrong, and even take over to fix labs automatically.

## Tech Stack

- **React 19** + **TypeScript** + **Vite 7**
- **Tailwind CSS 4** for styling
- **Zustand** for state management
- **@xyflow/react** for the interactive topology canvas
- **lucide-react** for icons
- **Clerk** for authentication
- **canvas-confetti** for lab completion celebrations

## Getting Started

```bash
# install dependencies
npm install

# start dev server
npm run dev

# build for production
npm run build

# preview production build
npm run preview
```

## Project Structure

```
src/
  App.tsx                    # Main app shell and view routing
  main.tsx                   # React entry point
  index.css                  # Global styles and CSS variables

  store/
    networkStore.ts          # Core network state (devices, links, simulator, lab progress)
    copilotStore.ts          # AI assistant state (messages, lab assist, per-lab conversations)
    uiStore.ts               # UI state (active view, topology tools, wire kind)
    settingsStore.ts         # User preferences (glow effects, compact tables, terminal context)

  network/
    simulator.ts             # NetworkSimulator - ping, traceroute, routing, ARP
    types.ts                 # Device, NetworkLink, NetworkInterface, Packet types
    failures.ts              # FailureInjection type and applyFailures()
    cables.ts                # Cable presets (copper, fiber, etc.)
    ip.ts                    # IP/subnet utilities
    arp.ts                   # ARP table building and resolution
    routing.ts               # Routing table lookups and best-route selection
    ping.ts                  # Ping simulation logic
    traceroute.ts            # Traceroute simulation logic
    packets.ts               # Packet and PacketTrace types
    builder.ts               # Topology construction helpers
    devices.ts               # Device lookup and interface utilities
    links.ts                 # Link and neighbor utilities
    interfaces.ts            # Interface helpers
    diagnostics.ts           # Diagnostic result types

  data/
    labs/
      starterLab.ts          # LabDefinition interface + baseline enterprise topology
      gatewayFailure.ts      # "The Wrong Gateway" lab
      interfaceFailure.ts    # "Silent Interface" lab
      routingFailure.ts      # "The Missing Route" lab
      index.ts               # ALL_LABS barrel export

  assistant/
    engine.ts                # Main AI message handler router
    engine.core.ts           # Core utilities (text, plan building, execution)
    engine.handlers.ts       # Configuration handlers (gateway, routes, interfaces)
    engine.handlers2.ts      # Diagnostic handlers (ping, diagnose, complete lab)
    parse.ts                 # Natural language command parser
    tools.ts                 # Connectivity matrix and diagnostic tools
    diagnose.ts              # Lab scanning and matrix formatting
    labAssist.ts             # AI takeover mode - step-by-step lab solving
    knowledge.ts             # Networking concept explanations
    types.ts                 # AssistantMessage, LabPlan, etc.

  components/
    layout/
      AppShell.tsx            # Main layout wrapper (sidebar + content + panels)
      Sidebar.tsx             # Navigation sidebar with lab info
      StatusBar.tsx           # Bottom status bar

    landing/
      LandingPage.tsx         # Unauthenticated landing page

    topology/
      TopologyCanvas.tsx      # Interactive network map (drag, wire, zoom)
      TopologyToolbar.tsx     # Toolbar for select, wire, delete, place devices

    terminal/
      NetworkTerminal.tsx     # In-app terminal with ping, traceroute, show commands

    traffic/
      TrafficMonitor.tsx      # Packet log viewer with filters and replay

    issues/
      IssueTracker.tsx        # Config and reachability audit results

    devices/
      DeviceTable.tsx         # Device inventory table
      DeviceInspector.tsx     # Device detail panel (interfaces, routes, ARP)

    labs/
      LabLibrary.tsx          # Lab selection grid with completion badges

    assistant/
      AICopilotPanel.tsx      # Chat interface for the AI assistant
      TakeoverOverlay.tsx     # Visual overlay during AI takeover mode
      RightSidebar.tsx        # Right sidebar container (copilot + device inspector)
      InspectorPanel.tsx      # Device inspector panel wrapper

    settings/
      SettingsView.tsx        # User preferences

    learn/
      LearnView.tsx           # Networking concepts reference

    common/
      (shared UI components)

  lib/
    celebrate.ts             # Lab completion confetti effect

  webmcp/
    (WebMCP integration)
```

## Core Concepts

### Network Simulator

The `NetworkSimulator` class (`src/network/simulator.ts`) is the heart of NetForge. It maintains the live network state and provides:

- **ping** - Simulate ICMP echo requests between any two hosts
- **traceroute** - Simulate TTL-based path discovery
- **getRoutingTable** - Return the routing table for any device
- **getARPTable** - Build ARP tables from live neighbor discovery

The simulator respects interface status, routing tables, static routes, and physical topology when determining reachability.

### Lab System

Labs are defined in `src/data/labs/` using the `LabDefinition` interface. Each lab provides:

- A topology (devices + links) cloned from the baseline enterprise network
- Optional `failures` that inject specific faults (wrong gateway, interface down, missing route)
- Metadata: title, difficulty, description, issue count

The `LabLibrary` component (`src/components/labs/LabLibrary.tsx`) displays all available labs. Labs track completion state per-lab ID using `localStorage` (`netforge-lab-progress`), so progress survives page refreshes and app restarts.

### AI Copilot

The AI assistant lives in `src/assistant/` and uses a natural language parser to understand commands. It can:

- **Diagnose** - Run connectivity matrices, explain failures, suggest fixes
- **Configure** - Set IP addresses, gateways, static routes, interface status
- **Take over** - In "Takeover mode", automatically apply fixes step-by-step with a visible timeline
- **Explain concepts** - Answer questions about networking topics

The copilot state (`src/store/copilotStore.ts`) maintains **per-lab conversations**. Each lab gets its own isolated chat history. Switching labs automatically clears or restores the correct conversation.

### State Management

Three Zustand stores manage the app:

| Store | Purpose |
|-------|---------|
| `networkStore` | Devices, links, simulator, lab loading/completion, issues, packets |
| `copilotStore` | AI messages, mode, lab assist state, per-lab conversations |
| `uiStore` | Active view, topology tools, wire kind, notices |
| `settingsStore` | Glow effects, compact tables, terminal context device |

Network state persists to `localStorage` (`netforge-network`) so the topology survives refreshes. Lab progress persists separately (`netforge-lab-progress`).

## Views

| View | Description |
|------|-------------|
| Dashboard | Stats overview + device inventory |
| Learn | Networking concepts reference |
| Lab Library | Browse and load labs, see completion status |
| Topology | Interactive network map with drag, wire, and device placement |
| Traffic | Packet log with filters, search, and topology replay |
| Issues | Config/reachability audit results with hints |
| Terminal | Command-line interface for ping, traceroute, show commands |
| Settings | User preferences |

## Available Commands (Terminal)

```
ping <destination>       # Test reachability
traceroute <destination> # Show path to destination
show ip route            # Display routing table
show arp                 # Display ARP table
show interfaces          # Display device interfaces
show devices             # List all devices
help                     # Show available commands
```

## AI Commands

- "Why can't PC-01 ping SRV-01?"
- "Find the problem"
- "Run connectivity tests"
- "Set PC-01 to 10.1.10.50/24 gateway 10.1.10.1"
- "Add a static route on R-02 to 10.1.20.0/24 via 10.1.0.6"
- "Complete this lab for me" (triggers AI takeover)

## Baseline Topology

The default enterprise topology includes:

- 3 PCs (workstations)
- 3 switches
- 3 routers (with static routes)
- 4 servers (Web, Application, Database, File)
- 11 links forming a multi-subnet routed network

## Lab Faults

Current labs inject single faults:

| Lab | Fault Type |
|-----|-----------|
| The Wrong Gateway | Wrong default gateway on a PC |
| Silent Interface | Interface administratively down |
| The Missing Route | Missing static route on a router |

## Contributing

This is a private educational project. The codebase follows these conventions:

- TypeScript strict mode
- Zustand for all global state
- Tailwind utility classes for styling
- Functional React components with hooks
- No prop drilling - stores handle cross-component state

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |
