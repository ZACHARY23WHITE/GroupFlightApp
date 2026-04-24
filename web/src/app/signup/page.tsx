import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center text-sm text-stone-500">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
