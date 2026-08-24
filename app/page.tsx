"use client";

import { FormEvent, useState } from "react";

type LookupResponse = {
  query: { user: string; groupId: string };
  user?: { id: string; username?: string; displayName?: string };
  databaseMatch: boolean;
  groupMembershipChecked: boolean;
  membership?: { isMember: boolean; groupName?: string; roleName?: string; rank?: number };
  message?: string;
  error?: string;
};

type GroupMatch = {
  username: string;
  displayName: string;
  userId: string;
  roleName: string;
  rank: number;
  profileUrl: string;
};

type GroupScanResponse = {
  groupId: string;
  scanned: number;
  matches: GroupMatch[];
  nextCursor: string | null;
  error?: string;
};

export default function Home() {
  const [user, setUser] = useState("");
  const [groupId, setGroupId] = useState("");
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanGroupId, setScanGroupId] = useState("");
  const [scanResult, setScanResult] = useState<GroupScanResponse | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const params = new URLSearchParams({ user: user.trim(), groupId: groupId.trim() });
      const response = await fetch(`/api/lookup?${params}`);
      setResult((await response.json()) as LookupResponse);
    } catch {
      setResult({
        query: { user, groupId },
        databaseMatch: false,
        groupMembershipChecked: false,
        error: "The lookup service could not be reached. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchGroupPage(cursor?: string) {
    const params = new URLSearchParams({ groupId: scanGroupId.trim() });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/group-members?${params}`);
    return (await response.json()) as GroupScanResponse;
  }

  async function onGroupScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScanLoading(true);
    setScanResult(null);
    try {
      setScanResult(await fetchGroupPage());
    } catch {
      setScanResult({ groupId: scanGroupId, scanned: 0, matches: [], nextCursor: null, error: "The group scan could not be reached. Please try again." });
    } finally {
      setScanLoading(false);
    }
  }

  async function loadMoreGroupMembers() {
    if (!scanResult?.nextCursor) return;
    setScanLoading(true);
    try {
      const nextPage = await fetchGroupPage(scanResult.nextCursor);
      setScanResult((previous) => previous && {
        ...nextPage,
        scanned: previous.scanned + nextPage.scanned,
        matches: [...previous.matches, ...nextPage.matches],
      });
    } catch {
      setScanResult((previous) => previous && { ...previous, error: "The next page could not be loaded. Please try again." });
    } finally {
      setScanLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Roblox moderation utility</p>
        <h1>Group lookup</h1>
        <p className="intro">
          Check whether a profile listed in your imported database currently belongs to a Roblox group.
        </p>
      </section>

      <form onSubmit={onSubmit} className="lookup-form">
        <label>
          Roblox username
          <input
            value={user}
            onChange={(event) => setUser(event.target.value)}
            placeholder="Builderman"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Roblox group ID
          <input
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="off"
            required
          />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Checking…" : "Check group"}</button>
      </form>

      {result && <ResultCard result={result} />}

      <section className="scan-section">
        <p className="eyebrow">Group-only scan</p>
        <h2>Find detected members in a group</h2>
        <p className="intro">Matches use Roblox usernames from the current group roster, not the source file&apos;s profile IDs.</p>
        <form onSubmit={onGroupScan} className="lookup-form group-form">
          <label>
            Roblox group ID
            <input
              value={scanGroupId}
              onChange={(event) => setScanGroupId(event.target.value)}
              placeholder="268995170"
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </label>
          <button type="submit" disabled={scanLoading}>{scanLoading ? "Scanning…" : "Scan group"}</button>
        </form>
        {scanResult && <GroupScanResult result={scanResult} loading={scanLoading} onLoadMore={loadMoreGroupMembers} />}
      </section>

      <p className="notice">
        A database match only means the supplied profile ID appears in the imported source file. It is not an independent finding about a person or an account. Group data is fetched from Roblox when a match is found.
      </p>
    </main>
  );
}

function GroupScanResult({ result, loading, onLoadMore }: { result: GroupScanResponse; loading: boolean; onLoadMore: () => void }) {
  if (result.error) {
    return <section className="result error" aria-live="polite"><h2>Couldn&apos;t scan group</h2><p>{result.error}</p></section>;
  }

  return (
    <section className="result group-result" aria-live="polite">
      <p className="result-label">Group {result.groupId}</p>
      <h2>{result.matches.length} detected {result.matches.length === 1 ? "member" : "members"}</h2>
      <p>Checked {result.scanned} current group members by Roblox username.</p>
      {result.matches.length > 0 && (
        <ul className="profile-list">
          {result.matches.map((member) => (
            <li key={member.userId}>
              <a href={member.profileUrl} target="_blank" rel="noreferrer">
                <strong>@{member.username}</strong>
                {member.displayName !== member.username && <span>{member.displayName}</span>}
                <small>{member.roleName} · Rank {member.rank}</small>
              </a>
            </li>
          ))}
        </ul>
      )}
      {result.nextCursor && <button className="load-more" type="button" onClick={onLoadMore} disabled={loading}>{loading ? "Scanning…" : "Scan next 100 members"}</button>}
    </section>
  );
}

function ResultCard({ result }: { result: LookupResponse }) {
  if (result.error) {
    return <section className="result error" aria-live="polite"><h2>Couldn&apos;t complete lookup</h2><p>{result.error}</p></section>;
  }

  if (!result.databaseMatch) {
    return (
      <section className="result neutral" aria-live="polite">
        <h2>No database match</h2>
        <p>{result.message ?? "This Roblox profile ID is not present in the imported database."}</p>
      </section>
    );
  }

  const identity = result.user?.username ? `@${result.user.username}` : `User ID ${result.user?.id}`;
  if (!result.groupMembershipChecked) {
    return <section className="result error" aria-live="polite"><h2>Database match found</h2><p>{result.message ?? "Roblox group membership could not be verified."}</p></section>;
  }

  const membership = result.membership;
  return (
    <section className={`result ${membership?.isMember ? "success" : "neutral"}`} aria-live="polite">
      <p className="result-label">Database match: {identity}</p>
      <h2>{membership?.isMember ? "Group member" : "Not a group member"}</h2>
      <p>
        {membership?.isMember
          ? `${identity} is in ${membership.groupName ?? `group ${result.query.groupId}`}${membership.roleName ? ` as ${membership.roleName}` : ""}.`
          : `${identity} is not currently listed in group ${result.query.groupId}.`}
      </p>
    </section>
  );
}

