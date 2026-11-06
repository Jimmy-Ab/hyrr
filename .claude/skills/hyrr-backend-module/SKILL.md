---
name: hyrr-backend-module
description: Use when adding or changing NestJS backend code in hyrr.backend (new endpoint, module, DTO, service logic, Prisma queries, socket events). Gives the module recipe, access-control rules, error conventions and the unit-test template.
---

# Hyrr backend module recipe

## Layout
`src/<feature>/{<feature>.module.ts, <feature>.controller.ts, <feature>.service.ts, dtos/*.dto.ts, <feature>.service.spec.ts}`. Register the module in `src/app.module.ts`.

## Controller
- `@UseGuards(JwtAuthGuard)` for authenticated routes; add `RolesGuard` + `@Roles("RECRUITER", "ADMIN")` for role gates (`src/auth/guards`, `src/auth/decorators/roles.decorator.ts`). Public routes: no guard; optional user: `OptionalJwtAuthGuard`.
- The actor is `req.user` = `{ userId, role, email, companyId }`. Pass it to services as `Actor` (`src/core/access/access.service.ts`).
- Declare specific routes (`:id/meta`, `:id/read`) **before** the generic `:id`.

## DTO
- Every body/query has a class with class-validator decorators. The global pipe uses `whitelist + forbidNonWhitelisted + transform`, so unknown fields are rejected.
- Bound strings (`@MaxLength`) and arrays (`@ArrayMaxSize`). Trim with `@Transform`.

## Service rules
- **Authorisation through `AccessService`**: `applicationFor(actor, id, "view"|"manage")`, `jobForView`, `jobForManagement`, `jobScopeWhere(actor)` (company scope), `isApplicationOwner`. Never filter recruiters by `recruiterId` alone; teammates share company data.
- **Errors**: `AppException(message, HttpStatus.X, "ERROR_CODE")` or the Not-found/Forbidden helpers in `src/core/exceptions/app-exception.ts`. Codes are SCREAMING_SNAKE and part of the API contract.
- **Multi-write operations** go in `this.prisma.$transaction(async (tx) => ...)`. Side effects (socket emits, notifications, emails) run **after** commit.
- **Idempotency**: anything retried by clients or webhooks gets a unique key and handles `P2002` by returning the existing row.
- **Payload hygiene**: use explicit `select` for user relations (never return `passwordHash`); seeker-facing application payloads use `SEEKER_APPLICATION_FIELDS` (no `ai*`, notes).
- **Lists** are bounded (`take`, default 50–200) and avoid N+1 (batch with `in: ids`, `groupBy`).
- Sockets: emit through `MessagesGateway` helpers (`emitToRooms`, rooms `user_<id>`, `company_<id>`, `chat_<applicationId>`).
- Notifications: `NotificationsService.createNotification(userId, title, type, actionView?, targetId?, { inApp? })`; it respects user preferences.
- Config via `process.env` with safe defaults; document new vars in `hyrr.backend/.env.example`.

## Unit-test template
```ts
const prisma: any = mockDeep<PrismaClient>()           // jest-mock-extended
prisma.$transaction.mockImplementation((fn: any) => (typeof fn === "function" ? fn(prisma) : Promise.all(fn)))
const access = { applicationFor: jest.fn(), jobScopeWhere: jest.fn().mockResolvedValue({}) } as any
const service = new FeatureService(prisma, access /* , other deps as {} as any */)
```
Test: happy path, authorisation failure, validation/conflict codes, and that seeker payloads omit private fields.

## Schema changes
Use the `hyrr-migration` skill (never `prisma migrate dev` against the user's DB).

## Verify
`cd hyrr.backend && npx tsc --noEmit -p . && npx jest src/<feature>`, then the full `npx jest`. For API/socket behaviour, run a live check with the `hyrr-smoke` skill.
