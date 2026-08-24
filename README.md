# Severe Database Group Lookup

A Vercel-ready Next.js tool that checks whether a Roblox account represented in an imported database currently belongs to a given Roblox group, or lists the database-detected profiles currently in a group.

## How it works

1. It resolves a Roblox username through Roblox.
2. It performs a constant-time case-insensitive match against the compact Roblox-username index bundled from the supplied CSV.
3. Only when the profile is present, it queries Roblox's group-role API and reports whether that user is in the supplied group.

For a group-only scan, the app reads Roblox's current group roster a page at a time and intersects it with the source usernames. Source profile IDs are not used for matching. Group membership is consequently a live Roblox check, not a claim stored in the CSV.

## Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## API

```
GET /api/lookup?user=<Roblox username>&groupId=<Roblox group ID>
```

Example response fields:

```json
{
  "databaseMatch": true,
  "groupMembershipChecked": true,
  "membership": { "isMember": true, "groupName": "Example", "roleName": "Member", "rank": 1 }
}
```

Group-only scans use `GET /api/group-members?groupId=<Roblox group ID>` and return up to 100 roster members per page, plus `nextCursor` when more are available. Each matched member includes a direct Roblox profile URL, username, display name, role, and rank. Exact individual lookups use a five-minute shared-cache TTL (`s-maxage=300`); group-roster pages use a one-minute TTL.

## Refresh the database index

The app bundles only a compact Roblox-username index, not the raw CSV. To rebuild it from a newer export:

```bash
npm run build:data -- "C:\path\to\Severe Injection Database - Refined Raw Data.csv"
```

The generated `data/roblox-usernames.json` is the deployed lookup index. It contains only deduplicated Roblox usernames and supports an in-memory O(1) set membership check.

## Deploy to Vercel

Import this GitHub repository in Vercel and use the default settings:

- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: leave blank

The project builds with the default Vercel settings and needs no environment variables. Vercel's CDN caches identical completed lookup responses at the edge.

