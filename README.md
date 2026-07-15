# AI-assisted video production platform

## Project overview

This repository is the foundation for an internal production tool that converts narration scripts into structured scenes, generated media, synchronized timelines, and rendered videos.

## Current capabilities

- Next.js application shell with Tailwind CSS and shadcn/ui.
- Clerk authentication with sign-in, sign-up, signed-in user controls, protected application routes, and dedicated auth pages.

## Architecture

The target architecture is a TypeScript modular monolith. The current repository contains the initial Next.js web application; database, workflow, storage, and renderer packages will be added in later phases.

## Technology stack

Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, and Clerk.

## Repository structure

```text
app/          Next.js routes and root layout
components/   React components, one component per PascalCase file
docs/         Bootstrap and phased implementation plans
lib/          Shared non-component utilities
public/       Static assets
```

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and supply the Clerk keys.
4. Run `npm run dev` and open `http://localhost:3000`.

## Environment variables

| Variable | Visibility | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Browser | Yes | Identifies the Clerk application. |
| `CLERK_SECRET_KEY` | Server only | Yes | Authenticates server-side Clerk requests. Never expose it to client code. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Browser | Yes | Local sign-in route; defaults to `/sign-in`. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Browser | Yes | Local sign-up route; defaults to `/sign-up`. |

## Database setup

Not implemented yet. PostgreSQL with Drizzle ORM is planned.

## Trigger.dev setup

Not implemented yet.

## Storage setup

Not implemented yet. Private Cloudflare R2 storage is planned.

## OpenAI setup

Not implemented yet.

## Rendering setup

Not implemented yet. Remotion, FFmpeg, and FFprobe are planned.

## Development commands

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run start` starts the production server.
- `npm run lint` runs ESLint.

## Testing commands

Automated test commands have not been added yet. TypeScript can be checked with `npx tsc --noEmit`.

## Deployment

Deployment automation is not implemented. Configure the same Clerk environment variables in the deployment environment before building.

## Security model

Clerk resolves browser sessions, while authorization is enforced at each protected server resource. Every page, Route Handler, or Server Function that accesses protected data must call `await auth.protect()` before accessing it. Future workspace authorization must also verify PostgreSQL membership; authentication alone does not grant workspace access. Clerk development telemetry is disabled through `ClerkProvider`.

## Cost controls

Billable AI and rendering operations are not implemented yet. Budget reservations and usage reconciliation remain required before those providers are enabled.

## Current limitations

- Workspace membership synchronization and authorization are not implemented.
- No database, generation workflow, storage integration, or renderer exists yet.
- Automated authentication browser tests are not configured yet.

## Implementation status

Bootstrap is in progress. The Next.js shell and Clerk authentication foundation are available.

## Recent major changes

- 2026-07-15: Linked the project to Clerk, added protected routing and auth pages, exposed polished account controls, and applied Clerk's shadcn theme.
- 2026-07-15: Migrated Clerk authorization away from deprecated path-based middleware checks to resource-based protection and disabled development telemetry.
