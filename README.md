# Projection Finance

Open-source DeFi position simulator. Model how your Aave, Morpho, Compound and
Uniswap positions evolve over time under different price and rate scenarios —
schedule actions, run stress tests, and project up to 365 days ahead.

**100% free and open-source. Every feature is unlocked for everyone, with no
limits, subscriptions or paywalls.**

## Features

- Multi-protocol position simulation (Aave V3, Morpho, Morpho Blue, Compound, Uniswap)
- Up to 365-day projections with scheduled actions (supply, borrow, repay, withdraw, swap)
- Price & APY rate scenarios with stress testing
- Portfolio sandbox: build from scratch or import real wallet holdings
- Liquidation radar across 17 Aave V3 networks
- AI-assisted insights, yield optimizer and strategy advisor
- Cloud save, auto-save and shareable projections
- Custom tokens and favorite wallets

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19
- TypeScript, Tailwind CSS, Radix UI
- Prisma + PostgreSQL
- NextAuth (Google, GitHub, email)
- ethers / Alchemy SDK / Aave contract helpers

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create a `.env` file. Common variables:

```bash
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_RESEND_KEY=...
ALCHEMY_API_KEY=...
OPENROUTER_API_KEY=...     # optional, AI features
CRON_SECRET=...            # protects /api/cron/* endpoints
ALERT_EMAIL=...            # optional, recipient for runtime/RPC alerts
```

### Database

```bash
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

## Build

```bash
pnpm build
pnpm start
```

## License

See [LICENSE](./LICENSE).
