"use client";

import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  normalizeMonolithRecord,
  normalizeSyndicateRecord,
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return snapshot;
}
