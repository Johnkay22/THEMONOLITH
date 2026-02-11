"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  normalizeMonolithRecord,
  normalizeSyndicateRecord,
  toNumber,
} from "@/lib/protocol/normalizers";
import type { MonolithOccupant, MonolithSnapshot, Syndicate } from "@/types/monolith";

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

  return [...withoutPrevious, nextSyndicate];
}

function parseSnapshotPayload(payload: unknown): MonolithSnapshot | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const row = payload as Record<string, unknown>;
  const monolithRecord =
    row.monolith && typeof row.monolith === "object" && !Array.isArray(row.monolith)
      ? (row.monolith as Record<string, unknown>)
      : null;

  if (!monolithRecord || typeof monolithRecord.id !== "string") {
    return null;
  }

  if (monolithRecord.id === "seed-monolith") {
    return null;
  }

  const monolithContent =
    typeof monolithRecord.content === "string" ? monolithRecord.content : null;
  const monolithCreatedAt =
    typeof monolithRecord.createdAt === "string"
      ? monolithRecord.createdAt
      : typeof monolithRecord.created_at === "string"
        ? monolithRecord.created_at
        : null;
  if (!monolithContent || !monolithCreatedAt) {
    return null;
  }

  const monolith: MonolithOccupant = {
    id: monolithRecord.id,
    content: monolithContent,
    valuation: toNumber(monolithRecord.valuation),
    ownerId:
      typeof monolithRecord.ownerId === "string"
        ? monolithRecord.ownerId
        : typeof monolithRecord.owner_id === "string"
          ? monolithRecord.owner_id
          : null,
    createdAt: monolithCreatedAt,
    active: monolithRecord.active === true,
  };

  if (!monolith.active) {
    return null;
  }

  const syndicatesRaw = Array.isArray(row.syndicates) ? row.syndicates : [];
  const syndicates = syndicatesRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const syndicateRecord = entry as Record<string, unknown>;
      const id = typeof syndicateRecord.id === "string" ? syndicateRecord.id : null;
      const proposedContent =
        typeof syndicateRecord.proposedContent === "string"
          ? syndicateRecord.proposedContent
          : typeof syndicateRecord.proposed_content === "string"
            ? syndicateRecord.proposed_content
            : null;
      const createdAt =
        typeof syndicateRecord.createdAt === "string"
          ? syndicateRecord.createdAt
          : typeof syndicateRecord.created_at === "string"
            ? syndicateRecord.created_at
            : null;
      const status = syndicateRecord.status;
      if (
        !id ||
        !proposedContent ||
        !createdAt ||
        (status !== "active" && status !== "won" && status !== "archived")
      ) {
        return null;
      }

      return {
        id,
        proposedContent,
        totalRaised: toNumber(
          syndicateRecord.totalRaised ?? syndicateRecord.total_raised,
        ),
        status,
        createdAt,
      } satisfies Syndicate;
    })
    .filter((entry): entry is Syndicate => entry !== null && entry.status === "active");

  return {
    monolith,
    syndicates,
  };
}

export function useMonolithRealtime(
  initialMonolith: MonolithOccupant,
  initialSyndicates: Syndicate[],
) {
  const [snapshot, setSnapshot] = useState<MonolithSnapshot>({
    monolith: initialMonolith,
    syndicates: initialSyndicates,
  });

  useEffect(() => {
    setSnapshot({
      monolith: initialMonolith,
      syndicates: initialSyndicates,
    });
  }, [initialMonolith, initialSyndicates]);

  const refreshSnapshot = useCallback(async () => {
    try {
      const response = await fetch("/api/monolith/snapshot", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as unknown;
      const nextSnapshot = parseSnapshotPayload(payload);
      if (!nextSnapshot) {
        return;
      }

      setSnapshot(nextSnapshot);
    } catch {
      // Network failures are ignored; realtime subscription remains primary.
    }
  }, []);

  const applySnapshot = useCallback((nextSnapshot: MonolithSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const applyMonolith = useCallback((nextMonolith: MonolithOccupant) => {
    setSnapshot((previous) => ({
      ...previous,
      monolith: nextMonolith,
    }));
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

          setSnapshot((previous) => ({
            ...previous,
            monolith: nextMonolith,
          }));
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
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void refreshSnapshot();
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

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSnapshot]);

  return {
    snapshot,
    refreshSnapshot,
    applySnapshot,
    applyMonolith,
    applySyndicate,
  };
}
