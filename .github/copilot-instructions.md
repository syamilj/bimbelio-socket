# Copilot Instructions for Bimbelio WhatsApp Notification WebSocket Service

## Project Overview
This is a **notification scheduling service** that sends WhatsApp/email reminders to users before their scheduled events (tryouts). It combines:
- **Express.js API** for receiving notification requests
- **Prisma ORM** (PostgreSQL) for persistent storage
- **Custom SimpleScheduler** for in-memory job scheduling
- **BullMQ** (dependency, not yet integrated) for future distributed job queue support

**Key Purpose**: Schedule notifications to be sent 2 minutes before a user's registered event.

## Architecture & Data Flow

### Core Components

1. **`src/index.ts`** (Main Application)
   - Express app listening on PORT (default 3000)
   - Bootstraps scheduler and loads pending notifications on startup
   - Two main endpoints: `POST /notif` (create reminder) and `GET /jobs` (debug view)

2. **`src/utils/schedule.ts`** (SimpleScheduler)
   - Custom in-memory job scheduler checking every 1000ms
   - Stores jobs in memory-only (lost on restart)
   - Executes callbacks when job's `runAt` time is reached
   - **Critical limitation**: No persistence between restarts—uses DB fallback in `getNotificationsToSchedule()`

3. **`src/utils/db.ts`** (Database Connection)
   - Singleton Prisma client instance
   - Connected to PostgreSQL via `DATABASE_URL` env variable

4. **`src/utils/job.ts`** (Job Type Definitions)
   - `NotifData`: Notification content (id, userId, message)
   - `JobFunction`: Callback signature for job execution
   - `Jobs` object: Global in-memory job store keyed by notification ID

5. **`prisma/schema.prisma`** (Data Model)
   - Single `Notification` model storing: id (UUID), userId, message, runAt (DateTime)
   - PostgreSQL datasource

## Key Developer Workflows

### Development
```bash
pnpm dev  # Runs with nodemon, auto-restarts on file changes
```
Uses `ts-node` for TypeScript execution.

### Database Management
```bash
prisma migrate dev --name <migration_name>  # Create migrations
prisma db push  # Sync schema to DB (dev only)
prisma studio  # Visual DB browser
```

### Environment Setup
- Create `.env` file with `DATABASE_URL=postgresql://...`
- Project uses `pnpm` (not npm)

## Code Patterns & Conventions

### Notification Lifecycle
1. Client POSTs to `/notif` with user data
2. Service calculates `effectiveReminderTime` (5 minutes from now, minus 2-minute buffer, but not before now)
3. Notification stored in PostgreSQL
4. Job scheduled in memory via `scheduler.schedule()`
5. When `runAt` time arrives, `sendNotification()` callback executes:
   - Logs notification details
   - **TODO**: Send email/WhatsApp (not yet implemented)
   - Deletes from DB and in-memory Jobs object

### Error Handling Pattern
- Job execution wrapped in try-catch with Promise handling in schedule loop
- Errors logged but don't stop scheduler
- See `scheduler.start()` for pattern

### Type Safety
- TypeScript strict mode enabled (`"strict": true`)
- All async functions explicitly typed with return types
- Prisma auto-generates types from schema

## Critical TODOs / Known Gaps

1. **`sendNotification()` function incomplete**:
   - Currently only logs and deletes
   - Needs: Email sending, WhatsApp API integration, DB update (reminder_sent flag)

2. **Scheduler limitations**:
   - Jobs lost on server restart (mitigated by `getNotificationsToSchedule()` loading from DB)
   - No job persistence in database—scheduler state not auditable
   - Single-server only (BullMQ integration would enable distributed queue)

3. **Missing notification sent tracking**:
   - No `reminder_sent` or `sent_at` field in schema yet
   - Add if audit trail needed

## Important Integration Points

- **Prisma Client**: Use `prisma.notification` for all DB operations (auto-typed)
- **Job State**: Always sync `Jobs` object with `sendNotification()` logic—deletes must remove from both
- **Scheduler Interval**: Set in constructor (default 1000ms); balance between responsiveness and CPU usage
- **Express Types**: `@types/express` and `@types/cors` already installed for strict typing

## Testing & Debugging

- `GET /jobs` endpoint returns current scheduler state (all pending jobs in memory)
- Logs include timestamps and full notification data
- Use `prisma studio` to verify DB state if scheduler doesn't execute

## File Organization
```
src/
  index.ts          # Express app & endpoints
  utils/
    db.ts           # Prisma singleton
    schedule.ts     # Custom scheduler class
    job.ts          # Type definitions & Jobs store
```

Keep utilities focused: db handling → `db.ts`, scheduling logic → `schedule.ts`, shared types → `job.ts`.
