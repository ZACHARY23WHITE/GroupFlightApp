import { Suspense } from "react";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata = {
  title: "Set up your profile · Group trip planner",
  description:
    "Personalize your group trip planner with your travel defaults and contact info.",
};

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center text-sm text-stone-500">
          Loading…
        </div>
      }
    >
      <OnboardingFlow />
    </Suspense>
  );
}
