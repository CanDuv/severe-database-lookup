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

export default function Home() {
  const [user, setUser] = useState("");
  const [groupId, setGroupId] = useState("");
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [loading, setLoading] = useState(false);

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
          Roblox username or user ID
          <input
            value={user}
            onChange={(event) => setUser(event.target.value)}
            placeholder="Builderman or 156"
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

      <p className="notice">
        A database match only means the supplied profile ID appears in the imported source file. It is not an independent finding about a person or an account. Group data is fetched from Roblox when a match is found.
      </p>
    </main>
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

