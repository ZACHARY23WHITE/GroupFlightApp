import { Suspense } from "react";
import { ExploreClient } from "./explore-client";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-stone-500">
          Loading…
        </div>
      }
    >
      <ExploreClient />
    </Suspense>
  );
}
