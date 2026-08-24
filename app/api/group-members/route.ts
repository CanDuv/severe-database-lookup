import database from "../../../data/roblox-usernames.json";

const groupIdPattern = /^\d{1,20}$/;
const databaseUsernames = new Set(database.usernames.map((value) => value.toLowerCase()));
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

type RobloxGroupMember = {
  user: { userId: number; username: string; displayName: string };
  role: { name: string; rank: number };
};

function respond(payload: object, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId")?.trim() ?? "";
  const cursor = searchParams.get("cursor")?.trim() ?? "";

  if (!groupIdPattern.test(groupId)) {
    return respond({ error: "Provide a numeric Roblox group ID." }, 400);
  }

  const url = new URL(`https://groups.roblox.com/v1/groups/${encodeURIComponent(groupId)}/users`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("sortOrder", "Asc");
  if (cursor) url.searchParams.set("cursor", cursor);

  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (response.status === 404) return respond({ error: "That Roblox group was not found." }, 404);
    if (!response.ok) throw new Error("Roblox group request failed");

    const page = (await response.json()) as { data?: RobloxGroupMember[]; nextPageCursor?: string | null };
    const members = page.data ?? [];
    const matches = members
      .filter((member) => databaseUsernames.has(member.user.username.toLowerCase()))
      .map((member) => ({
        username: member.user.username,
        displayName: member.user.displayName,
        userId: String(member.user.userId),
        roleName: member.role.name,
        rank: member.role.rank,
        profileUrl: `https://www.roblox.com/users/${member.user.userId}/profile`,
      }));

    return respond({
      groupId,
      scanned: members.length,
      matches,
      nextCursor: page.nextPageCursor ?? null,
    });
  } catch {
    return respond({ error: "Roblox could not load this group right now. Please retry shortly." }, 502);
  }
}

