import Link from "next/link";

export default function TripNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-normal text-stone-900">
        Trip not found
      </h1>
      <p className="text-sm leading-relaxed text-stone-500">
        That link may be wrong or the trip was removed.
      </p>
      <Link
        href="/"
        className="text-sm font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
      >
        Start a new trip
      </Link>
    </div>
  );
}
