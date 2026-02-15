"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  normalizeMonolithRecord,
  normalizeSyndicateRecord,
} from "@/lib/protocol/normalizers";
import type {
  MonolithDisplacementEvent,
  MonolithOccupant,
  MonolithSnapshot,
  Syndicate,
} from "@/types/monolith";

type RealtimeConnectionStatus = "connecting" | "live" | "degraded";

function parseRealtimeMonolithRecord(
  payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
) {
  const record = payload.new;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }

  const row = record as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.content !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }

  const monolith = normalizeMonolithRecord(row);
  if (!monolith.active) {
    return null;
  }

  return monolith;
}

function parseRealtimeSyndicateRecord(
  payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
) {
  const nextRecord = payload.new;
  if (!nextRecord || typeof nextRecord !== "object" || Array.isArray(nextRecord)) {
    return null;
  }

  return normalizeSyndicateRecord(nextRecord as Record<string, unknown>);
}

function removeSyndicateById(syndicates: Syndicate[], id: string) {
  return syndicates.filter((syndicate) => syndicate.id !== id);
}

function upsertActiveSyndicate(syndicates: Syndicate[], nextSyndicate: Syndicate) {
  const withoutPrevious = removeSyndicateById(syndicates, nextSyndicate.id);
  if (nextSyndicate.status !== "active") {
    return withoutPrevious;
  }

  const previousSyndicate = syndicates.find(
    (syndicate) => syndicate.id === nextSyndicate.id,
  );
  const mergedSyndicate = previousSyndicate
    ? {
        ...nextSyndicate,
        contributorCount:
          nextSyndicate.contributorCount > 0
            ? nextSyndicate.contributorCount
            : previousSyndicate.contributorCount,
        recentContributorCount:
          nextSyndicate.recentContributorCount > 0
            ? nextSyndicate.recentContributorCount
            : previousSyndicate.recentContributorCount,
      }
    : nextSyndicate;
  return [...withoutPrevious, mergedSyndicate];
}

function parseLatestDisplacementEvent(
  payload: unknown,
): MonolithDisplacementEvent | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const row = payload as Record<string, unknown>;
  if (
    typeof row.previousContent !== "string" ||
    typeof row.currentContent !== "string" ||
    typeof row.displacedAt !== "string"
  ) {
    return null;
  }

  const previousValuation = Number(row.previousValuation);
  const currentValuation = Number(row.currentValuation);

  return {
    previousContent: row.previousContent,
    previousValuation: Number.isFinite(previousValuation) ? previousValuation : 0,
    currentContent: row.currentContent,
    currentValuation: Number.isFinite(currentValuation) ? currentValuation : 0,
    displacedAt: row.displacedAt,
  };
}

function buildDisplacementEvent(
  previousMonolith: MonolithOccupant,
  nextMonolith: MonolithOccupant,
): MonolithDisplacementEvent | null {
  if (previousMonolith.id === nextMonolith.id) {
    return null;
  }

  const previousTimestamp = Date.parse(previousMonolith.createdAt);
  const nextTimestamp = Date.parse(nextMonolith.createdAt);
  if (
    !Number.isNaN(previousTimestamp) &&
    !Number.isNaN(nextTimestamp) &&
    nextTimestamp < previousTimestamp
  ) {
    return null;
  }

  return {
    previousContent: previousMonolith.content,
    previousValuation: previousMonolith.valuation,
    currentContent: nextMonolith.content,
    currentValuation: nextMonolith.valuation,
    displacedAt: nextMonolith.createdAt,
  };
}

function parseSnapshotPayload(payload: unknown): MonolithSnapshot | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const row = payload as Record<string, unknown>;
  const monolithRecordRaw =
    row.monolith && typeof row.monolith === "object" && !Array.isArray(row.monolith)
      ? (row.monolith as Record<string, unknown>)
      : null;

  if (!monolithRecordRaw) {
    return null;
  }

  const monolith = normalizeMonolithRecord(monolithRecordRaw);
  if (monolith.id === "seed-monolith" || !monolith.active) {
    return null;
  }

  const syndicatesRaw = Array.isArray(row.syndicates) ? row.syndicates : [];
  const syndicates = syndicatesRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      return normalizeSyndicateRecord(entry as Record<string, unknown>);
    })
    .filter((entry): entry is Syndicate => entry !== null && entry.status === "active");

  const latestDisplacement = parseLatestDisplacementEvent(row.latestDisplacement);

  return {
    monolith,
    syndicates,
    latestDisplacement,
  };
}

export function useMonolithRealtime(
  initialMonolith: MonolithOccupant,
  initialSyndicates: Syndicate[],
  initialLatestDisplacement: MonolithDisplacementEvent | null = null,
) {
  const [snapshot, setSnapshot] = useState<MonolithSnapshot>({
    monolith: initialMonolith,
    syndicates: initialSyndicates,
    latestDisplacement: initialLatestDisplacement,
  });
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeConnectionStatus>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    setSnapshot((previousSnapshot) => {
      const previousTimestamp = Date.parse(previousSnapshot.monolith.createdAt);
      const incomingTimestamp = Date.parse(initialMonolith.createdAt);
      if (
        !Number.isNaN(previousTimestamp) &&
        !Number.isNaN(incomingTimestamp) &&
        incomingTimestamp < previousTimestamp
      ) {
        return previousSnapshot;
      }

      return {
        monolith: initialMonolith,
        syndicates: initialSyndicates,
        latestDisplacement: initialLatestDisplacement,
      };
    });
  }, [initialLatestDisplacement, initialMonolith, initialSyndicates]);

  const refreshSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`/api/monolith/snapshot?ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as unknown;
      const nextSnapshot = parseSnapshotPayload(payload);
      if (!nextSnapshot) {
        return;
      }

      setSnapshot((previousSnapshot) => {
        const previousTimestamp = Date.parse(previousSnapshot.monolith.createdAt);
        const nextTimestamp = Date.parse(nextSnapshot.monolith.createdAt);

        if (
          !Number.isNaN(previousTimestamp) &&
          !Number.isNaN(nextTimestamp) &&
          nextTimestamp < previousTimestamp
        ) {
          return previousSnapshot;
        }

        return nextSnapshot;
      });
      setLastSyncAt(new Date().toISOString());
    } catch {
      // Network failures are ignored; realtime subscription remains primary.
    }
  }, []);

  const applySnapshot = useCallback((nextSnapshot: MonolithSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const applyMonolith = useCallback((nextMonolith: MonolithOccupant) => {
    setSnapshot((previous) => {
      const latestDisplacement =
        buildDisplacementEvent(previous.monolith, nextMonolith) ??
        previous.latestDisplacement;
      return {
        ...previous,
        monolith: nextMonolith,
        latestDisplacement,
      };
    });
  }, []);

  const applySyndicate = useCallback((nextSyndicate: Syndicate) => {
    setSnapshot((previous) => ({
      ...previous,
      syndicates: upsertActiveSyndicate(previous.syndicates, nextSyndicate),
    }));
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setRealtimeStatus("degraded");
      return;
    }

    const channel = supabase
      .channel("monolith-history-stream")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monolith_history",
        },
        (payload) => {
          const nextMonolith = parseRealtimeMonolithRecord(payload);
          if (!nextMonolith) {
            return;
          }

          setSnapshot((previous) => {
            const latestDisplacement =
              buildDisplacementEvent(previous.monolith, nextMonolith) ??
              previous.latestDisplacement;
            return {
              ...previous,
              monolith: nextMonolith,
              latestDisplacement,
            };
          });
          setLastSyncAt(new Date().toISOString());
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "syndicates",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const previousRecord = payload.old;
            const previousRow =
              previousRecord &&
              typeof previousRecord === "object" &&
              !Array.isArray(previousRecord)
                ? (previousRecord as Record<string, unknown>)
                : null;
            const previousId =
              previousRow && typeof previousRow.id === "string"
                ? previousRow.id
                : null;

            if (!previousId) {
              return;
            }

            setSnapshot((previous) => ({
              ...previous,
              syndicates: removeSyndicateById(previous.syndicates, previousId),
            }));
            setLastSyncAt(new Date().toISOString());

            return;
          }

          const nextSyndicate = parseRealtimeSyndicateRecord(payload);
          if (!nextSyndicate) {
            return;
          }

          setSnapshot((previous) => ({
            ...previous,
            syndicates: upsertActiveSyndicate(previous.syndicates, nextSyndicate),
          }));
          setLastSyncAt(new Date().toISOString());
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("live");
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("degraded");
          void refreshSnapshot();
        }
        if (status === "CLOSED") {
          setRealtimeStatus("degraded");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    void refreshSnapshot();

    const intervalId = window.setInterval(() => {
      void refreshSnapshot();
    }, 6000);

    const handleWindowFocus = () => {
      void refreshSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSnapshot();
      }
    };

    const handlePageShow = () => {
      void refreshSnapshot();
    };

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSnapshot]);

  return {
    snapshot,
    refreshSnapshot,
    applySnapshot,
    applyMonolith,
    applySyndicate,
    realtimeStatus,
    lastSyncAt,
  };
}
