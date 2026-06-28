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
