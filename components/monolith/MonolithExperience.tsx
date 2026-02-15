"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AcquireSoloModal } from "@/components/monolith/AcquireSoloModal";
import { ContributeSyndicateModal } from "@/components/monolith/ContributeSyndicateModal";
import { ControlDeck } from "@/components/monolith/ControlDeck";
import { InitializeSyndicateModal } from "@/components/monolith/InitializeSyndicateModal";
import { MonolithDisplay } from "@/components/monolith/MonolithDisplay";
import { ProtocolModal } from "@/components/monolith/ProtocolModal";
import { ProtocolTermsModal } from "@/components/monolith/ProtocolTermsModal";
import { SyndicateContributorsModal } from "@/components/monolith/SyndicateContributorsModal";
import { SyndicateFundedModal } from "@/components/monolith/SyndicateFundedModal";
import { SyndicateLedger } from "@/components/monolith/SyndicateLedger";
import { useMonolithRealtime } from "@/hooks/useMonolithRealtime";
import { buildSyndicateLedgerRows } from "@/lib/protocol/normalizers";
import { calculateDisplacementCost, formatUsd } from "@/lib/protocol/pricing";
import type {
  MonolithDisplacementEvent,
  MonolithOccupant,
  MonolithSnapshot,
  Syndicate,
  SyndicateLedgerRow,
} from "@/types/monolith";

type MonolithExperienceProps = {
  initialMonolith: MonolithOccupant;
  initialSyndicates: Syndicate[];
  initialLatestDisplacement: MonolithDisplacementEvent | null;
};

type ToastState = {
  id: string;
  message: string;
  variant: "error" | "success";
};

type TimelineState = {
  id: string;
  actionLabel: string;
  finalLabel: "MONOLITH UPDATED" | "LEDGER UPDATED";
  status: "initiated" | "confirmed" | "updated" | "failed";
  lastStep: 0 | 1 | 2;
  errorMessage: string | null;
};

export function MonolithExperience({
  initialMonolith,
  initialSyndicates,
  initialLatestDisplacement,
}: MonolithExperienceProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAcquireSoloModalOpen, setIsAcquireSoloModalOpen] = useState(false);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [isProtocolTermsModalOpen, setIsProtocolTermsModalOpen] = useState(false);
  const [selectedSyndicateId, setSelectedSyndicateId] = useState<string | null>(
    null,
  );
  const [isContributorModalOpen, setIsContributorModalOpen] = useState(false);
  const [contributors, setContributors] = useState<string[]>([]);
  const [isLoadingContributors, setIsLoadingContributors] = useState(false);
  const [isFundedCongratsOpen, setIsFundedCongratsOpen] = useState(false);
  const [textureEnabled, setTextureEnabled] = useState(true);
  const [timeline, setTimeline] = useState<TimelineState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const {
    snapshot,
    refreshSnapshot,
    applySnapshot,
    applyMonolith,
    applySyndicate,
    realtimeStatus,
    lastSyncAt,
  } = useMonolithRealtime(
    initialMonolith,
    initialSyndicates,
    initialLatestDisplacement,
  );

  const displacementCost = useMemo(
    () => calculateDisplacementCost(snapshot.monolith.valuation),
    [snapshot.monolith.valuation],
  );

  const ledgerRows = useMemo(
    () => buildSyndicateLedgerRows(snapshot.syndicates, displacementCost),
    [displacementCost, snapshot.syndicates],
  );
  const selectedSyndicate = useMemo(
    () =>
      selectedSyndicateId
        ? ledgerRows.find((row) => row.id === selectedSyndicateId) ?? null
        : null,
    [ledgerRows, selectedSyndicateId],
  );
  const leadingSyndicate = useMemo(
    () => (ledgerRows.length > 0 ? ledgerRows[0] : null),
    [ledgerRows],
  );

  useEffect(() => {
    const storedPreference =
      typeof window !== "undefined"
        ? window.localStorage.getItem("monolith_texture_enabled")
        : null;
    if (storedPreference === "false") {
      setTextureEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    document.body.setAttribute("data-texture", textureEnabled ? "on" : "off");
    window.localStorage.setItem(
      "monolith_texture_enabled",
      textureEnabled ? "true" : "false",
    );
  }, [textureEnabled]);

  const formatActiveDuration = (createdAt: string) => {
    const ageMs = Date.now() - Date.parse(createdAt);
    if (!Number.isFinite(ageMs) || ageMs < 0) {
      return "0m";
    }

    const ageMinutes = Math.floor(ageMs / 60_000);
    if (ageMinutes < 60) {
      return `${ageMinutes}m`;
    }
    const ageHours = Math.floor(ageMinutes / 60);
    if (ageHours < 24) {
      return `${ageHours}h`;
    }

    const ageDays = Math.floor(ageHours / 24);
    return `${ageDays}d`;
  };

  const formatSyncAge = (timestamp: string) => {
    const ageMs = Date.now() - Date.parse(timestamp);
    if (!Number.isFinite(ageMs) || ageMs < 0) {
      return "just now";
    }

    const seconds = Math.floor(ageMs / 1000);
    if (seconds < 8) {
      return "just now";
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const queueSnapshotReconciliation = () => {
    window.setTimeout(() => {
      void refreshSnapshot();
    }, 900);
  };

  const cloneSnapshot = (value: MonolithSnapshot): MonolithSnapshot => ({
    monolith: { ...value.monolith },
    syndicates: value.syndicates.map((syndicate) => ({ ...syndicate })),
    latestDisplacement: value.latestDisplacement
      ? { ...value.latestDisplacement }
      : null,
  });

  const showToast = (
    variant: "error" | "success",
    message: string,
    autoHideDelayMs = 3600,
  ) => {
    const nextToast = {
      id: crypto.randomUUID(),
      message,
      variant,
    };
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((currentToast) =>
        currentToast?.id === nextToast.id ? null : currentToast,
      );
    }, autoHideDelayMs);
  };

  const showTransactionFailedToast = (details?: string) => {
    const message = details?.trim()
      ? `Transaction Failed: ${details}`
      : "Transaction Failed";
    showToast("error", message);
  };

  const startTimeline = (
    actionLabel: string,
    finalLabel: "MONOLITH UPDATED" | "LEDGER UPDATED",
  ) => {
    const nextTimelineId = crypto.randomUUID();
    setTimeline({
      id: nextTimelineId,
      actionLabel,
      finalLabel,
      status: "initiated",
      lastStep: 0,
      errorMessage: null,
    });

    return nextTimelineId;
  };

  const markTimelineConfirmed = (timelineId: string) => {
    setTimeline((previous) => {
      if (!previous || previous.id !== timelineId) {
        return previous;
      }

      return {
        ...previous,
        status: "confirmed",
        lastStep: 1,
        errorMessage: null,
      };
    });
  };

  const markTimelineUpdated = (
    timelineId: string,
    finalLabel: "MONOLITH UPDATED" | "LEDGER UPDATED",
  ) => {
    setTimeline((previous) => {
      if (!previous || previous.id !== timelineId) {
        return previous;
      }

      return {
        ...previous,
        status: "updated",
        finalLabel,
        lastStep: 2,
        errorMessage: null,
      };
    });

    window.setTimeout(() => {
      setTimeline((previous) =>
        previous?.id === timelineId ? null : previous,
      );
    }, 5200);
  };

  const markTimelineFailed = (timelineId: string, message: string) => {
    setTimeline((previous) => {
      if (!previous || previous.id !== timelineId) {
        return previous;
      }

      return {
        ...previous,
        status: "failed",
        errorMessage: message,
      };
    });
  };

  const applySnapshotIfFresh = (nextSnapshot: MonolithSnapshot | undefined) => {
    if (!nextSnapshot || nextSnapshot.monolith.id === "seed-monolith") {
      return;
    }

    const nextTimestamp = Date.parse(nextSnapshot.monolith.createdAt);
    const currentTimestamp = Date.parse(snapshot.monolith.createdAt);
    if (
      !Number.isNaN(nextTimestamp) &&
      !Number.isNaN(currentTimestamp) &&
      nextTimestamp < currentTimestamp
    ) {
      return;
    }

    applySnapshot(nextSnapshot);
  };

  const handleOpenContributors = async () => {
    const sourceSyndicateId = snapshot.monolith.sourceSyndicateId;
    if (!sourceSyndicateId) {
      return;
    }

    setIsContributorModalOpen(true);
    setIsLoadingContributors(true);
    try {
      const response = await fetch(
        `/api/syndicates/contributors?syndicateId=${encodeURIComponent(sourceSyndicateId)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      if (!response.ok) {
        setContributors([]);
        return;
      }

      const payload = (await response.json()) as {
        contributors?: Array<{ name?: string }>;
      };
      const names = Array.isArray(payload.contributors)
        ? payload.contributors.map((entry) =>
            typeof entry.name === "string" && entry.name.trim()
              ? entry.name.trim()
              : "Anonymous",
          )
        : [];
      setContributors(names);
    } catch {
      setContributors([]);
    } finally {
      setIsLoadingContributors(false);
    }
  };

  const handleInitializeSyndicate = async (draft: {
    proposedContent: string;
    initialContribution: number;
    authorName: string;
    notifyEmail: string;
    notifyOnFunded: boolean;
    notifyOnEveryContribution: boolean;
  }) => {
    const previousSnapshot = cloneSnapshot(snapshot);
    const timelineId = startTimeline("INITIALIZE SYNDICATE", "LEDGER UPDATED");
    try {
      const response = await fetch("/api/syndicates/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      let payload:
        | {
            error?: string;
            syndicate?: Syndicate;
            snapshot?: MonolithSnapshot;
            coupExecuted?: boolean;
          }
        | null = null;
      try {
        payload = (await response.json()) as {
          error?: string;
          syndicate?: Syndicate;
          snapshot?: MonolithSnapshot;
        };
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Failed to initialize syndicate. Please try again.",
        );
      }
      markTimelineConfirmed(timelineId);

      if (payload?.syndicate) {
        applySyndicate(payload.syndicate);
      }
      applySnapshotIfFresh(payload?.snapshot);

      setIsModalOpen(false);
      if (payload?.coupExecuted) {
        setIsFundedCongratsOpen(true);
      }
      markTimelineUpdated(
        timelineId,
        payload?.coupExecuted ? "MONOLITH UPDATED" : "LEDGER UPDATED",
      );
      queueSnapshotReconciliation();
    } catch (error) {
      applySnapshot(previousSnapshot);
      const message =
        error instanceof Error ? error.message : "Failed to initialize syndicate.";
      markTimelineFailed(timelineId, message);
      showTransactionFailedToast(message);
      throw error;
    }
  };

  const handleAcquireSolo = async (draft: {
    content: string;
    bidAmount: number;
    authorName: string;
    notifyEmail: string;
  }) => {
    const previousSnapshot = cloneSnapshot(snapshot);
    const timelineId = startTimeline("ACQUIRE SOLO", "MONOLITH UPDATED");
    const optimisticMonolith: MonolithOccupant = {
      id: `optimistic-${crypto.randomUUID()}`,
      content: draft.content,
      valuation: draft.bidAmount,
      ownerId: null,
      authorName: draft.authorName.trim() || null,
      authorEmail: draft.notifyEmail.trim().toLowerCase() || null,
      sourceType: "solo",
      sourceSyndicateId: null,
      fundedByCount: null,
      fundedInDays: null,
      createdAt: new Date().toISOString(),
      active: true,
    };
    applyMonolith(optimisticMonolith);

    try {
      const response = await fetch("/api/monolith/acquire-solo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: draft.content,
          bidAmount: draft.bidAmount,
          authorName: draft.authorName,
          notifyEmail: draft.notifyEmail,
        }),
      });

      let payload:
        | {
            error?: string;
            monolith?: MonolithOccupant;
            snapshot?: MonolithSnapshot;
          }
        | null = null;
      try {
        payload = (await response.json()) as {
          error?: string;
          monolith?: MonolithOccupant;
          snapshot?: MonolithSnapshot;
        };
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Failed to acquire the monolith. Please try again.",
        );
      }
      markTimelineConfirmed(timelineId);

      if (payload?.monolith) {
        applyMonolith(payload.monolith);
      }
      applySnapshotIfFresh(payload?.snapshot);

      setIsAcquireSoloModalOpen(false);
      markTimelineUpdated(timelineId, "MONOLITH UPDATED");
      queueSnapshotReconciliation();
    } catch (error) {
      applySnapshot(previousSnapshot);
      const message =
        error instanceof Error ? error.message : "Failed to acquire the monolith.";
      markTimelineFailed(timelineId, message);
      showTransactionFailedToast(message);
      throw error;
    }
  };

  const handleContributeSyndicate = async (draft: {
    syndicateId: string;
    amount: number;
    authorName: string;
    notifyEmail: string;
    notifyOnFunded: boolean;
  }) => {
    const previousSnapshot = cloneSnapshot(snapshot);
    const timelineId = startTimeline("COMMIT FUNDS", "LEDGER UPDATED");
    try {
      const response = await fetch("/api/syndicates/contribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      let payload:
        | {
            error?: string;
            syndicate?: Syndicate;
            snapshot?: MonolithSnapshot;
            coupExecuted?: boolean;
          }
        | null = null;
      try {
        payload = (await response.json()) as {
          error?: string;
          syndicate?: Syndicate;
          snapshot?: MonolithSnapshot;
        };
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Failed to contribute to syndicate. Please try again.",
        );
      }
      markTimelineConfirmed(timelineId);

      if (payload?.syndicate) {
        applySyndicate(payload.syndicate);
      }
      applySnapshotIfFresh(payload?.snapshot);

      setSelectedSyndicateId(null);
      if (payload?.coupExecuted === true) {
        setIsFundedCongratsOpen(true);
        showToast("success", "Syndicate Funded. Congratulations.", 4200);
      }
      markTimelineUpdated(
        timelineId,
        payload?.coupExecuted ? "MONOLITH UPDATED" : "LEDGER UPDATED",
      );
      queueSnapshotReconciliation();
    } catch (error) {
      applySnapshot(previousSnapshot);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to contribute to syndicate.";
      markTimelineFailed(timelineId, message);
      showTransactionFailedToast(message);
      throw error;
    }
  };

  return (
    <>
      <main className="mx-auto flex min-h-svh w-full max-w-[1400px] flex-col px-4 pb-[calc(1.4rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8">
        {toast ? (
          <div
            className={`mb-3 border px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.15em] ${
              toast.variant === "success"
                ? "border-[#9fb4ff]/70 bg-[#9fb4ff]/10 text-[#b9c7ff]"
                : "border-white bg-black/90 text-white/90"
            }`}
          >
            [ {toast.message} ]
          </div>
        ) : null}

        <header className="mb-2 flex items-center justify-between border border-white bg-white px-4 py-3 text-black">
          <h1
            className="text-[1.9rem] font-semibold leading-none sm:text-[2.1rem]"
            style={{ fontFamily: 'var(--font-display), "Times New Roman", serif' }}
          >
            THE MONOLITH
          </h1>
          <button
            type="button"
            className="font-mono text-[0.82rem] uppercase tracking-[0.14em] text-black transition-opacity hover:opacity-70"
            onClick={() => setIsProtocolModalOpen(true)}
          >
            [ THE WAY ]
          </button>
        </header>

        <div className="mb-3 border-y border-white/25 py-2 text-center font-mono text-xs uppercase tracking-[0.14em] text-white/86">
          CURRENT VALUATION:{" "}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`valuation-${snapshot.monolith.valuation.toFixed(2)}`}
              className="inline-block text-[#b9c7ff]"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {formatUsd(snapshot.monolith.valuation)}
            </motion.span>
          </AnimatePresence>
          <span className="px-2 text-white/45">|</span>
          MINIMUM BID:{" "}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`minimum-${displacementCost.toFixed(2)}`}
              className="inline-block"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {formatUsd(displacementCost)}
            </motion.span>
          </AnimatePresence>
        </div>

        {timeline ? (
          <section className="mb-3 border border-white/18 px-3 py-3">
            <p className="font-mono text-[0.57rem] uppercase tracking-[0.15em] text-white/64">
              {timeline.actionLabel}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                "INITIATED",
                "CONFIRMED",
                timeline.finalLabel,
              ].map((label, index) => {
                const isComplete = index < timeline.lastStep;
                const isCurrent =
                  index === timeline.lastStep && timeline.status !== "failed";

                return (
                  <div
                    key={label}
                    className={`border px-2 py-1 text-center font-mono text-[0.53rem] uppercase tracking-[0.13em] ${
                      isComplete || isCurrent
                        ? "border-[#9fb4ff]/70 text-[#b9c7ff]"
                        : "border-white/16 text-white/38"
                    }`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            {timeline.status === "failed" && timeline.errorMessage ? (
              <p className="mt-2 font-mono text-[0.54rem] uppercase tracking-[0.13em] text-white/70">
                [ FAILED ] {timeline.errorMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(23rem,0.8fr)] lg:gap-6">
          <section className="relative flex min-h-[42svh] flex-1 flex-col justify-center py-3 lg:min-h-[64vh]">
            <div className="min-h-[14rem] flex-1">
              <MonolithDisplay
                content={snapshot.monolith.content}
                transitionKey={snapshot.monolith.id}
              />
            </div>
            {snapshot.monolith.sourceType === "solo" &&
            snapshot.monolith.authorName ? (
              <p className="mt-2 text-right text-[0.9rem] italic tracking-[0.05em] text-white/72">
                - {snapshot.monolith.authorName}
              </p>
            ) : null}
            {snapshot.monolith.sourceType === "syndicate" ? (
              <div className="mt-2 space-y-1 text-right">
                <p className="text-[0.9rem] italic tracking-[0.05em] text-white/72">
                  - {snapshot.monolith.authorName ?? "Anonymous"}
                </p>
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.13em] text-white/66">
                  Funded by {snapshot.monolith.fundedByCount ?? 0}{" "}
                  {snapshot.monolith.sourceSyndicateId ? (
                    <button
                      type="button"
                      className="underline decoration-white/50 underline-offset-2 transition-colors hover:text-white"
                      onClick={handleOpenContributors}
                    >
                      users
                    </button>
                  ) : (
                    "users"
                  )}{" "}
                  in {snapshot.monolith.fundedInDays ?? 1} days.
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <ControlDeck
                displacementCost={displacementCost}
                onAcquireSolo={() => setIsAcquireSoloModalOpen(true)}
                onInitializeSyndicate={() => setIsModalOpen(true)}
              />
            </div>
          </section>

          <div className="space-y-3">
            <aside className="hidden space-y-3 lg:block">
              <section className="border border-white/20 px-3 py-3">
                <h3 className="ui-label text-[0.62rem] text-white/70">
                  LIVE PROTOCOL STATUS
                </h3>
                <p
                  className={`mt-2 font-mono text-[0.58rem] uppercase tracking-[0.13em] ${
                    realtimeStatus === "live"
                      ? "text-[#b9c7ff]"
                      : realtimeStatus === "connecting"
                        ? "text-white/72"
                        : "text-white/55"
                  }`}
                >
                  {realtimeStatus === "live"
                    ? "Realtime synchronized"
                    : realtimeStatus === "connecting"
                      ? "Realtime connecting"
                      : "Realtime degraded"}
                </p>
                <p className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.13em] text-white/56">
                  Last sync: {formatSyncAge(lastSyncAt)}
                </p>
              </section>

              <section className="border border-white/20 px-3 py-3">
                <h3 className="ui-label text-[0.62rem] text-white/70">
                  LATEST DISPLACEMENT EVENT
                </h3>
                {snapshot.latestDisplacement ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[0.72rem] italic leading-snug text-white/83">
                      &quot;{snapshot.latestDisplacement.previousContent}&quot;
                    </p>
                    <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-white/62">
                      displaced by &quot;{snapshot.latestDisplacement.currentContent}&quot;
                    </p>
                    <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-white/62">
                      {formatUsd(snapshot.latestDisplacement.previousValuation)} →{" "}
                      {formatUsd(snapshot.latestDisplacement.currentValuation)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 font-mono text-[0.55rem] uppercase tracking-[0.13em] text-white/50">
                    No displacement recorded yet.
                  </p>
                )}
              </section>

              <section className="border border-white/20 px-3 py-3">
                <h3 className="ui-label text-[0.62rem] text-white/70">
                  CURRENTLY WINNING PRESSURE
                </h3>
                {leadingSyndicate ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[0.72rem] leading-snug text-white/83">
                      {leadingSyndicate.proposedContent}
                    </p>
                    <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-white/62">
                      Active for {formatActiveDuration(leadingSyndicate.createdAt)}
                    </p>
                    <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-white/62">
                      Needs{" "}
                      {formatUsd(
                        Math.max(
                          0,
                          leadingSyndicate.target - leadingSyndicate.totalRaised,
                        ),
                      )}{" "}
                      to coup ({Math.floor(leadingSyndicate.progressRatio * 100)}%)
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 font-mono text-[0.55rem] uppercase tracking-[0.13em] text-white/50">
                    No active pressure.
                  </p>
                )}
              </section>
            </aside>

            <section className="space-y-2 border-t border-white/20 pt-3 lg:border lg:border-white/20 lg:px-4 lg:py-3">
              <h2 className="ui-label text-[0.68rem]">
                ACTIVE SYNDICATES ({ledgerRows.length})
              </h2>
              <SyndicateLedger
                syndicates={ledgerRows}
                onSelect={(syndicate: SyndicateLedgerRow) =>
                  setSelectedSyndicateId(syndicate.id)
                }
              />
            </section>
          </div>
        </div>

        <footer className="mt-4 border-t border-white/20 pt-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/62 transition-colors hover:text-white"
              onClick={() => setTextureEnabled((previous) => !previous)}
            >
              {textureEnabled ? "TEXTURE: ON" : "TEXTURE: OFF"}
            </button>
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/62 transition-colors hover:text-white"
              onClick={() => setIsProtocolTermsModalOpen(true)}
            >
              PROTOCOL &amp; TERMS
            </button>
          </div>
        </footer>
      </main>

      <InitializeSyndicateModal
        open={isModalOpen}
        minimumContribution={1}
        onClose={() => setIsModalOpen(false)}
        onDeploy={handleInitializeSyndicate}
      />

      <AcquireSoloModal
        open={isAcquireSoloModalOpen}
        minimumBid={displacementCost}
        onClose={() => setIsAcquireSoloModalOpen(false)}
        onAcquire={handleAcquireSolo}
      />

      <ProtocolModal
        open={isProtocolModalOpen}
        onClose={() => setIsProtocolModalOpen(false)}
      />

      <ProtocolTermsModal
        open={isProtocolTermsModalOpen}
        onClose={() => setIsProtocolTermsModalOpen(false)}
      />

      <ContributeSyndicateModal
        open={Boolean(selectedSyndicateId)}
        syndicate={selectedSyndicate}
        minimumContribution={1}
        onClose={() => setSelectedSyndicateId(null)}
        onContribute={handleContributeSyndicate}
      />

      <SyndicateContributorsModal
        open={isContributorModalOpen}
        contributors={
          isLoadingContributors ? ["Loading contributors..."] : contributors
        }
        onClose={() => setIsContributorModalOpen(false)}
      />

      <SyndicateFundedModal
        open={isFundedCongratsOpen}
        onClose={() => setIsFundedCongratsOpen(false)}
      />
    </>
  );
}
