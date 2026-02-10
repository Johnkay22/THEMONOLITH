"use client";

import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { MonolithOccupant } from "@/types/monolith";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRealtimeMonolithRecord(
  payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>,
) {
  const record = payload.new;
  if (!record || typeof record !== "object") {
    return null;
  }

  if (record.active !== true) {
    return null;
  }

  if (
    typeof record.id !== "string" ||
    typeof record.content !== "string" ||
    typeof record.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    content: record.content,
    valuation: toNumber(record.valuation),
    ownerId: typeof record.owner_id === "string" ? record.owner_id : null,
    createdAt: record.created_at,
    active: true,
  } satisfies MonolithOccupant;
}

export function useMonolithRealtime(initialMonolith: MonolithOccupant) {
  const [monolith, setMonolith] = useState(initialMonolith);

  useEffect(() => {
    setMonolith(initialMonolith);
  }, [initialMonolith]);

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

          setMonolith(nextMonolith);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return monolith;
}
