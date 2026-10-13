export default function Loading() {
  return (
    <div className="pb-12" aria-busy="true" aria-label="Loading departures">
      <div className="bg-gradient-to-r from-brand-darker via-brand-dark to-brand">
        <div className="container-x py-5">
          <div className="h-7 w-56 animate-pulse rounded-lg bg-white/20" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-white/15" />
        </div>
      </div>
      <div className="container-x">
        <div className="mt-4 flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-14 min-w-[84px] flex-1 animate-pulse rounded-xl bg-white ring-1 ring-slate-200" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="hidden h-48 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200 lg:block" />
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="card flex gap-4 p-5">
                <div className="h-24 w-36 animate-pulse rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="hidden w-32 space-y-3 md:block">
                  <div className="h-7 animate-pulse rounded bg-slate-200" />
                  <div className="h-10 animate-pulse rounded-xl bg-orange-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
