# Media service

Private NestJS service that owns the `images` table and Cloudinary signing
credentials. Runtime traffic enters through versioned Nest TCP patterns in
`@uitfood/contracts`; only `/live` and `/ready` are exposed on the separate
management HTTP port.

Local setup:

```powershell
$env:DATABASE_URL = 'postgresql://media:media_secret@localhost:5432/uitfood_media'
pnpm --filter media run db:migrate
pnpm --filter media run dev
```

Data backfill and rollback sync use two explicitly scoped credentials:

```powershell
$env:SOURCE_DATABASE_URL = '<legacy database URL>'
$env:TARGET_DATABASE_URL = '<media database URL>'
$env:MEDIA_SYNC_DIRECTION = 'source-to-target'
pnpm --filter media run db:sync
```

Set `MEDIA_SYNC_DIRECTION=target-to-source` only during a rehearsed rollback
window after legacy Media writes have been disabled. The command exits with
code 2 when row counts or deterministic SHA-256 fingerprints differ.
