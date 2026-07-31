"use client";

export default function QrSkeleton({
  rows = 3,
  testId,
}: {
  rows?: number;
  testId?: string;
}) {
  return (
    <div className="space-y-3" data-testid={testId} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-28 animate-pulse rounded-[20px] bg-white/80 motion-reduce:animate-none sm:h-32"
        />
      ))}
    </div>
  );
}
