import { MonolithExperience } from "@/components/monolith/MonolithExperience";
import { getLandingSnapshot } from "@/lib/protocol/monolith";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getLandingSnapshot();

  return (
    <MonolithExperience
      initialMonolith={snapshot.monolith}
      initialSyndicates={snapshot.syndicates}
    />
  );
}
