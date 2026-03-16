# Pontifex TODO

## Missing API Endpoints

### Token Groups (no controller exists)
- [x] `POST /api/applications/:appId/token-groups` — Create token group (UI: `components/token-group/index.tsx:129`)
- [x] `PATCH /api/applications/:appId/token-groups/:id` — Update token group description (UI: `components/token-group/index.tsx:85`)
- [x] `DELETE /api/applications/:appId/token-groups` — Delete token group (UI: `components/token-group/index.tsx:173`)

### Token Request
- [x] `POST /api/request-token` — OAuth token request for the token tester page (UI: `resources/index.ts:128`)

### Scopes
- [x] `PATCH /api/applications/:appId/scopes` — Update application scopes (UI: `components/environment/index.tsx:599`)

### Users
- [x] `GET /api/users/search?prefix=` — Search users by prefix (UI: `pages/applications/[id].tsx:287`, `pages/groups/[id].tsx:131`)

### Groups
- [x] `DELETE /api/groups/:id` — Delete group (UI: `pages/groups/[id].tsx:107`)

## HTTP Method / Path Mismatches

UI calls PATCH but backend exposes PUT:
- [x] `PATCH /api/groups/:id/owners` — backend has `PUT` (UI: `pages/groups/[id].tsx:179`)
- [x] `PATCH /api/groups/:id/members` — backend has `PUT` (UI: `pages/groups/[id].tsx:199`)
- [x] `PATCH /api/environments/:id` — backend has `PUT` (UI: `pages/environments/[id]/index.tsx:178`)

Path mismatches:
- [x] `POST /api/environments/:id/removePassword` — backend has `DELETE /api/environments/passwords/:id` (UI: `components/passwords/index.tsx:58`)
- [x] `GET /api/applications/:id/audit` — backend has `GET /api/applications/:id/audit-events` (UI: `resources/index.ts:66`)

## Stub / Incomplete Services

- [x] `AuditEventService.publishEvent()` — no-op stub, audit events are never persisted (`modules/audit-event/audit-event.service.ts`)
- [x] `ApplicationTokenGroupModule` — empty module, should house the token group controller
- [x] `UserService` returns empty `pendingPermissionRequests` and `groupedPendingPermissionRequests` — should use `PermissionRequestService`

## Code TODOs

### Auth
- [x] Add proper auth guards to `ApplicationController` (`application.controller.ts:39`) — `AzureAdAuthGuard` applied globally via `APP_GUARD`
- [x] Add proper auth guards to `EnvironmentController` (`environment.controller.ts:35`) — `AzureAdAuthGuard` applied globally via `APP_GUARD`
- [x] Add proper auth guards to `PermissionRequestController` (`permission-request.controller.ts:9`) — `AzureAdAuthGuard` applied globally via `APP_GUARD`

### AAD Integration
- [x] Grant User.Read permission to service principals on app creation (`application.controller.ts:154`)
- [x] Use AAD object ID for environment creation instead of generating locally (`application.controller.ts:411`)

### Email Notifications
- [x] Wire up emails for permission request creation (`environment.controller.ts:351`)
- [x] Wire up emails for permission request status updates (`environment.controller.ts:366`)
- [x] Send email and log audit events on permission request actions (`permission-request.service.ts:343`)

### Data Cleanup
- [x] Remove `requiredResourceAccess` from inbound PR environments on app deletion (`application.service.ts:81`)
- [x] Improve temporary `targetPermissionId`/`targetPermissionName` handling (`environment.controller.ts:293`)

### Query Organization
- [x] Move inline Gremlin query to service in `role.service.ts:101`

### UI
- ~~Filter connection wizard to only show applications containing the source environment level (`pages/connections/update.tsx:317`)~~ — not needed
