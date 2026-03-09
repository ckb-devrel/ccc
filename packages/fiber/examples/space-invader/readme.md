# Phaser's Revenge: A Layer 2 Gaming Demo

Phaser's Revenge is a example game that taking from [Phaser.js](https://phaser.io/) and adapted for the [Fiber network](http://fiber.world/) that demonstrates real-time token payment using off-chain solution similar to [Lightning Network](https://lightning.network/). The game showcases how traditional gaming mechanics can be seamlessly integrated with blockchain technology for instant micro-payments.

## Game Overview

In this Space Invaders-style game:

- Players control a spaceship to shoot a boss enemy ship and dodge attacks
- Each successful hit earns points that are instantly converted to CKB tokens
- When players take damage, they lose points (and tokens)
- All token transfers occur in real-time through Fiber Network channels

## Blockchain Integration

This demo leverages Fiber Network to enable:

- Real-time token transfers between player and boss (game host)
- Instant settlement of game points as CKB tokens
- Zero-latency gameplay with blockchain features
- Minimal transaction fees through Layer 2 scaling

### Prerequisites

Before running the game, you need to set up the Fiber Network environment:

1. Set up two local Fiber nodes (one for player, one for boss)
2. Open a payment channel between the these two nodes
3. Each node must deposit 500 CKB into its channel

**Note for Developers:** This is a simplified demo. In a production environment, you'll need to implement:

- Channel opening logic with player matching
- Final scores are settled on-chain when the game ends including proper channel close
- Error handling for insufficient channel balance
- Security measures for channel management

## Getting Started

### Option A: Run with two Fiber nodes (launcher)

From the monorepo root or `packages/fiber`, you can start two fiber-js nodes and the game in one command:

```bash
cd packages/fiber
pnpm run space-invader:dev:with-nodes
```

This starts two Fiber nodes (RPC on 8227 and 8237), connects them, writes `public/fiber.config.generated.json`, and runs the game dev server. Press Ctrl+C to stop nodes and server.

**Real CKB in channels:** To fund channels with real testnet CKB (≥500 CKB per node), set these env vars with 32-byte hex keys (with or without `0x` prefix) for pre-funded testnet addresses:

- `FIBER_CKB_SECRET_KEY_A` – CKB secret for node A (boss)
- `FIBER_CKB_SECRET_KEY_B` – CKB secret for node B (player)

If unset, nodes use random keys (channels will not have real CKB). Optional P2P identity keys: `FIBER_FIBER_KEY_A`, `FIBER_FIBER_KEY_B`.

### Option B: Use your own nodes

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Configure your Fiber nodes (refer to [Fiber Network documentation](http://fiber.world/docs)).
3. Update peer information in `src/config/fiber.config.ts` (or provide a generated config at `public/fiber.config.generated.json`).
4. Start the development server:

```bash
pnpm run dev
```

### Build for production

```bash
pnpm run build
```

## Technical Details

- Game Engine: Phaser.js
- Layer 2 Solution: Fiber Network
- Base Layer: Nervos CKB
- Token: Native CKB

## Disclaimer

This is a demonstration project to showcase the capabilities of Fiber Network for gaming applications. The implementation is simplified for educational purposes. Production applications should implement proper security measures, error handling, and user management systems.
