# NetForge

**A network that agents can actually debug.**

NetForge is a hands-on networking lab you run in the browser. Instead of learning routing, ARP, gateways and subnets from diagrams, you work on a live simulated network — break it, investigate it, and fix it. It ships with an AI copilot that can see the same network you do, and a set of WebMCP tools so an outside AI agent can drive the simulator directly.

---

## What you can do

- Build and rewire a topology of PCs, switches, routers and servers on a canvas
- Inspect any device's interfaces, IPs, gateway, routes and ARP table
- Run real commands in an in-app terminal: `ping`, `traceroute`, `show ip route`, `show arp`, `show interfaces`, `show devices`
- Run a full connectivity sweep across every host pair
- Work through troubleshooting labs that inject a specific, realistic fault
- Ask the AI copilot what's wrong, or hand it the whole lab and watch it solve it step by step
- Let an external AI agent operate the simulator through WebMCP

The point is to make practice feel like actually troubleshooting a network, not reading about one.

---

## Why we built it

Networking is hard to learn from theory alone. You can read what a default gateway does ten times and still not really get it until something is misconfigured and nothing can leave the subnet.

So we built a place where you can break a network on purpose, see the symptom, chase it down, and fix it — and where an AI can look at the *same* live state you're looking at, run the same diagnostics, and explain the problem instead of just handing you the answer.

---

## The AI copilot

The copilot works on your live topology. It can:

- **Diagnose** — run connectivity tests, read device config, and point at the actual fault (wrong gateway, down interface, missing route, bad next hop, etc.)
- **Configure** — set IP addresses, gateways, static routes, and interface status when you ask it to
- **Take over** — in Takeover mode it solves the whole lab on-screen: it highlights each affected device, narrates what it's changing, applies the fix, and re-verifies every path. You watch it happen instead of the answer appearing instantly.
- **Explain** — answer plain networking questions ("what's a default gateway and how do I know mine's wrong?")

### How the AI is wired

Chat and takeover planning go through `api/assistant.js`, a small serverless function that talks to any **OpenAI-compatible** chat API. It's configured with environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `AI_API_KEY` | your API key (server-side only, never shipped to the browser) | — |
| `AI_MODEL` | model id | `kira-auto` |
| `AI_BASE_URL` | chat-completions endpoint | `https://kiraai.vn/api/v1/chat/completions` |

If no key is set, or the API is slow or down, the copilot **falls back to a local rule-based engine** so it always answers — it just won't be as smart. Locally, `npm run dev` runs the same function through a small Vite middleware (`vite.config.ts`), so the copilot behaves the same in dev and in production.

---

## WebMCP

NetForge exposes its simulator as tools an AI agent can call, using the [W3C Web Model Context API](https://github.com/webmachinelearning/webmcp) (`document.modelContext`). Because native browser support is still rolling out, it registers through the [`@mcp-b/webmcp-polyfill`](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill) runtime when the native API isn't present. Registration happens on startup in `src/main.tsx` → `src/webmcp/register.ts`.

### Tools (10)

| Tool | What it does |
|---|---|
| `netforge_list_labs` | List every lab with its id, difficulty and fault count |
| `netforge_get_state` | Current lab, device/link counts, open issues, whether it's solved |
| `netforge_get_topology` | Full text dump of every device, interface, route and link |
| `netforge_run_connectivity_tests` | Ping every host pair; report pass count and each failure |
| `netforge_ping` | Ping between two devices; returns reachability and hop path |
| `netforge_diagnose` | Root-cause analysis + the fix plan it would apply |
| `netforge_load_lab` | Load a lab by id (swaps in that fault) |
| `netforge_apply_suggested_fix` | Apply the top proposed fix, re-test, mark complete if fully restored |
| `netforge_take_over_lab` | Run the full multi-step AI takeover on the current lab |
| `netforge_set_view` | Switch the app's active view |

Every tool runs against the same simulator state the app uses, so an agent can inspect the network, find a fault, change a config, and check whether it fixed it.

### Testing

The tools were exercised in **Google Chrome** through the `@mcp-b/webmcp-polyfill` runtime (v5.1.0) and its `navigator.modelContextTesting` list/execute interface. Verified end to end:

- All 10 tools register and list via `document.modelContext.getTools()`
- Loading labs, running the connectivity sweep, single pings, diagnosis
- Applying a fix and confirming connectivity afterward

Example: load **The Wrong Gateway** → ping `PC-02 → SRV-01` fails ("ARP resolution failed for gateway") → `netforge_apply_suggested_fix` sets the gateway to `10.1.10.1` → sweep returns 42/42 and the lab is marked complete → the same ping now succeeds via `PC-02 → R-01 → R-02 → R-03 → SRV-01`.

Not yet tested against ChatGPT's in-app browser or Chrome's native WebMCP implementation — those need the client-side WebMCP setup on the tester's machine. The standard `document.modelContext` tool surface is exposed correctly for any of them to pick up.

---

## The labs

Every lab starts from the same enterprise topology and injects a specific fault (or four). Fix it, and NetForge re-runs every connectivity test and marks the lab complete.

| Lab | Level | What's broken |
|---|---|---|
| **Competition Lab** | baseline | Nothing — the healthy reference network to explore |
| **The Wrong Gateway** | beginner | A PC has the wrong default gateway |
| **Silent Interface** | beginner | A transit interface between routers is administratively down |
| **The Missing Route** | intermediate | A router is missing a static route to the server subnet |
| **DHCP Pool Gone Wrong** | intermediate | A PC got a lease from the wrong scope and can't reach anything |
| **Stale DNS Record** | intermediate | DNS resolves the site to an address the server no longer holds |
| **Locked Out by Port Security** | intermediate | Overnight "hardening" left a PC cut off at Layer 2 |
| **The Broken NAT Edge** | advanced | Translated traffic at the edge router dies mid-path |
| **Full Troubleshooting: Four Faults** | advanced | Four simultaneous faults across a PC, another PC, and two routers — isolate and fix each one |

---

## The network simulator

`src/network/simulator.ts` is the core. It models:

- ICMP `ping` and TTL-based `traceroute`
- ARP resolution from live neighbor discovery
- Routing-table lookups, connected routes and static routes
- Interface status (a down interface breaks ARP, ping and routing)
- End-to-end reachability and the exact packet path

It always works off the real topology and device config, so any change you make — in the canvas, the terminal, the copilot, or a WebMCP tool — actually affects whether traffic gets through.

---

## Views

| View | What it's for |
|---|---|
| **Dashboard** | Stats + device inventory |
| **Learn** | Short networking explainers and references |
| **Device Lab** | A separate guided CLI sandbox for practicing device configuration |
| **Lab Library** | Browse and load troubleshooting labs, see completion badges |
| **Topology** | The interactive network map — drag, wire, add and inspect devices |
| **Traffic** | Packet log with filters, search and topology replay |
| **Issues** | Live config + reachability audit, hints, verification, resolution history |
| **Terminal** | Command line for `ping` / `traceroute` / `show …` |
| **Settings** | Preferences, plus reset controls for labs and all progress |

---

## Tech stack

- **React 19** + **TypeScript** (strict) + **Vite 7**
- **Tailwind CSS 4**
- **Zustand** for state
- **@xyflow/react** for the topology canvas
- **lucide-react** icons, **canvas-confetti** for the lab-complete celebration
- **Clerk** for auth
- **@mcp-b/webmcp-polyfill** for the WebMCP runtime
- **Vercel** for hosting + the `api/assistant.js` serverless function

---

## Project structure

```
api/
  assistant.js               # Serverless AI backend (any OpenAI-compatible chat API)

vite.config.ts               # Vite config + local dev bridge for /api/assistant

src/
  App.tsx                    # App shell + view routing
  main.tsx                   # Entry point; also registers WebMCP tools

  store/
    networkStore.ts          # Devices, links, simulator, labs, issues, packets
    copilotStore.ts          # AI messages, mode, takeover state, per-lab chats
    uiStore.ts               # Active view, topology tools
    settingsStore.ts         # User preferences
    deviceLabStore.ts        # Device Lab CLI sandbox state
    progressStore.ts         # Learn lesson progress

  network/
    simulator.ts             # NetworkSimulator: ping, traceroute, routing, ARP
    ping.ts / traceroute.ts / routing.ts / arp.ts
    ip.ts / cables.ts / failures.ts / diagnostics.ts
    builder.ts / devices.ts / links.ts / interfaces.ts / packets.ts
    types.ts

  data/labs/                 # LabDefinition + all 9 labs + baseline topology

  assistant/
    engine.ts                # Message router (rule engine vs LLM)
    engine.core.ts / engine.handlers.ts / engine.handlers2.ts
    parse.ts                 # Natural-language command parser
    llm.ts                   # Bridge to /api/assistant + response validation
    tools.ts / diagnose.ts   # Connectivity matrix + root-cause analysis
    labAssist.ts             # AI takeover: step-by-step lab solving
    knowledge.ts / context.ts / types.ts

  devicelab/                 # Device Lab CLI engine
  webmcp/
    register.ts              # Registers the 10 netforge_* WebMCP tools

  components/
    layout/ landing/ topology/ terminal/ traffic/ issues/
    devices/ labs/ assistant/ settings/ learn/ devicelab/

  lib/celebrate.ts           # Lab-complete confetti
```

---

## State & persistence

State is local to the browser (`localStorage`), so your work survives a refresh:

| Key | Holds |
|---|---|
| `netforge-network` | Current topology and device config |
| `netforge-lab-progress` | Which labs you've completed |
| `netforge-learn-progress` | Learn lessons marked done |
| `netforge-device-lab` | Device Lab sandbox state |
| `netforge-settings` | UI preferences |

Settings → *Reset all progress* clears every one of these.

---

## Getting started

```bash
npm install
npm run dev        # dev server (includes the /api/assistant bridge)
npm run build      # type-check + production build
npm run preview    # preview the production build
```

To enable the smart copilot, create a `.env` with at least:

```
AI_API_KEY=your-key-here
AI_MODEL=kira-auto
```

Without it, the copilot still runs on its local rule-based engine.

---

## What's next

- More labs and fault types
- Richer packet/traffic animation
- Deeper AI troubleshooting and more WebMCP tools
- Testing against ChatGPT's in-app browser and native Chrome WebMCP
- Progress tracking and learning stats

---

## AI tools used

ChatGPT and Claude Code were used during development for planning, implementation, debugging, and the WebMCP integration. All architecture, feature decisions, and testing were reviewed and integrated by us.

---

## License

Educational / competition use.
