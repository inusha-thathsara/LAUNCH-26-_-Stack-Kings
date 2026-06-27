# RelicOps Control Center

A simulator for Launch26 Phase 01: The Relic Ring Protocol.

## Features

- Loads universe-config.json dynamically
- Displays Zeta-26 planets on a 2D map
- Builds graph using Lmax constraint
- Sends packets between planets
- Finds lowest-latency route using Dijkstra
- Converts payload between planet codex/base systems
- Shows full hop_log
- Shows latency breakdown
- Supports chaos test: kill node / kill link
- Automatically reroutes next packet

## Tech Stack

- Next.js
- Tailwind CSS
- JavaScript
- Docker

## Run Locally

```bash
npm install
npm run dev