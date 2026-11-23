# Mirvo AI Firestore Security Specification

## 1. Data Invariants
1. Every document under `/users/{userId}` strictly belongs to the authenticated, verified Firebase user whose `request.auth.uid == userId`.
2. User PII (`email`) is strictly isolated to the owner (`get`/`list`/`write` denied to all other users).
3. Every subcollection document under `/users/{userId}/lessons/{lessonId}` verifies both owner UID (`userId == request.auth.uid`) and parent existence (`exists(/databases/$(database)/documents/users/$(userId))`), and enforces immutable `userId` and `createdAt`.
4. All IDs match `^[a-zA-Z0-9_\-]+$` (`size <= 128`), all string fields have strict `.size()` bounds matching `firebase-blueprint.json`, and all timestamps must equal `request.time`.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Unauthenticated read on `/users/uid1`**: `request.auth == null` -> `PERMISSION_DENIED`.
2. **Cross-user read on `/users/uid2` by `uid1`**: `request.auth.uid != userId` -> `PERMISSION_DENIED`.
3. **Unverified email write on `/users/uid1`**: `email_verified == false` -> `PERMISSION_DENIED`.
4. **Shadow/ghost field on UserProfile create** (`{ ..., role: "admin" }`): blocked by `keys().hasOnly(...)` -> `PERMISSION_DENIED`.
5. **Identity spoofing on UserProfile create** (`{ uid: "otherUid", ... }`): blocked by `data.uid == request.auth.uid` -> `PERMISSION_DENIED`.
6. **Oversized ID poisoning** (`userId` > 128 chars or invalid chars): blocked by `isValidId(userId)` -> `PERMISSION_DENIED`.
7. **Client-forged timestamp on create/update** (`createdAt` != `request.time`): blocked by `== request.time` -> `PERMISSION_DENIED`.
8. **Immutable field mutation on UserProfile update** (`uid` or `createdAt` altered): blocked by `affectedKeys().hasOnly(...)` and immutability checks -> `PERMISSION_DENIED`.
9. **Value poisoning on UserProfile update** (`displayName` empty or > 100 chars): blocked by `isValidUserProfile(incoming())` -> `PERMISSION_DENIED`.
10. **Orphaned lesson write under `/users/uid1/lessons/l1` when parent `/users/uid1` does not exist**: blocked by `exists(...)` parent check -> `PERMISSION_DENIED`.
11. **Invalid enum `subject` or `engine` on SavedLessonRecord**: blocked by `data.subject in [...]` -> `PERMISSION_DENIED`.
12. **Blanket `list` query on `/users` or cross-user `/users/uid2/lessons`**: blocked (`list` on `/users` denied; `/users/{userId}/lessons` restricted to `resource.data.userId == request.auth.uid && isOwner(userId)`) -> `PERMISSION_DENIED`.
13. **VideoLessonCache list scraping / cross-creator overwrite / unverified write**: `list` on `/videoLessons` is denied (`allow list: if false`); `create` requires `isVerified()`, valid `selectedModelId` allowlist, bounded `segments` array (`1..15`), and `createdByUid == request.auth.uid`; `update` requires `existing().createdByUid == request.auth.uid`.
