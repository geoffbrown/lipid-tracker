/**
 * First-load placeholders.
 *
 * Each mirrors the structure of the screen it stands in for — same wrappers,
 * same padding, same margins — so the placeholder occupies the space the real
 * content will take and nothing jumps when the data lands. Copying the class
 * names rather than inventing a layout is the point: the geometry stays right
 * because it is the same geometry.
 *
 * These show on a first load only. useAppData seeds from its cache after that,
 * so navigating between screens goes straight to content.
 */

/** One placeholder block. Width and height come from the call site. */
function Bone({ className = "" }: { className?: string }) {
  return <span className={`bone block ${className}`} />;
}

/* Reference figures are longer than labels and rows differ in width — varying
   these stops the placeholder reading as a rigid grid, which no real screen
   looks like. */
const ROW_W = ["w-[46%]", "w-[62%]", "w-[38%]", "w-[54%]", "w-[44%]"];

function MetricBone() {
  return (
    <div className="tile min-w-0 px-4 py-4">
      <span className="flex items-center justify-between gap-1">
        <Bone className="h-3.5 w-9" />
        <Bone className="h-3 w-7" />
      </span>
      <Bone className="mt-1.5 h-[27px] w-[70%]" />
      {/* The reference rail is a real hairline even while loading: it is
          structure, not data, and drawing it steadies the block. */}
      <span className="relative mt-3.5 block h-[9px] w-full" aria-hidden>
        <span className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line-strong" />
      </span>
      {/* Provenance wraps to two lines in the phone-width column — "Martin-
          Hopkins" is the common case — and the trend sits under it. Three
          lines, not two, or the chart below starts too high. */}
      <Bone className="mt-3 h-3.5 w-[80%]" />
      <Bone className="mt-2 h-3.5 w-[45%]" />
      <Bone className="mt-2.5 h-3.5 w-[70%]" />
    </div>
  );
}

function RowBone({ width }: { width: string }) {
  return (
    <div className="tile flex w-full items-center justify-between gap-3 px-4 py-4">
      <span className="min-w-0 flex-1">
        <span className="mb-2 flex items-center gap-1.5">
          <Bone className="h-4 w-12 rounded-full" />
          <Bone className="h-4 w-24" />
        </span>
        <Bone className={`h-6 ${width}`} />
      </span>
      <Bone className="h-4 w-4 shrink-0 rounded-full" />
    </div>
  );
}

function PageHeading() {
  return (
    <div className="flex items-center justify-between gap-3 py-4 sm:pb-5 sm:pt-6">
      <Bone className="h-7 w-40 sm:h-9 sm:w-56" />
      <Bone className="h-9 w-20 rounded-full" />
    </div>
  );
}

function SectionLabel() {
  return <Bone className="mt-8 mb-2.5 ml-1 h-3.5 w-32" />;
}

const shell = "mx-auto max-w-3xl px-4 pb-28 sm:px-6 sm:pb-14 sm:pt-2";

export function DashboardSkeleton() {
  return (
    <main className={shell} aria-busy="true" aria-label="Loading dashboard">
      <PageHeading />
      <div className="mt-5 grid grid-cols-3 gap-2">
        <MetricBone />
        <MetricBone />
        <MetricBone />
      </div>
      {/* Mirrors TrendChart's section exactly: header, its one-line conclusion,
          the source control, the 216px plot, the range control. Standing in for
          all of that with one grey slab is what makes a skeleton feel like a
          placeholder rather than the page arriving. */}
      <section className="tile mt-5 px-4 py-5">
        <div className="flex items-baseline gap-2">
          <Bone className="h-6 w-16" />
          <Bone className="h-5 w-24" />
        </div>
        <Bone className="mt-1 mb-5 h-[18px] w-[62%]" />
        <Bone className="mb-5 h-[42px] w-[208px] rounded-lg" />
        {/* The plot area is drawn as gridlines rather than filled: a 216px
            block of solid grey is the heaviest thing on the screen, and the
            chart it stands for is mostly white space. */}
        <div className="flex h-[216px] flex-col justify-between py-3.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="h-3 w-7 shrink-0" />
              <span className="h-px flex-1 bg-line" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-center">
          <Bone className="h-[42px] w-[186px] rounded-lg" />
        </div>
      </section>
      <SectionLabel />
      <div className="flex flex-col gap-2">
        {ROW_W.slice(0, 3).map((w, i) => <RowBone key={i} width={w} />)}
      </div>
    </main>
  );
}

export function HistorySkeleton() {
  return (
    <main className={shell} aria-busy="true" aria-label="Loading history">
      <div className="flex items-baseline justify-between py-4">
        <Bone className="h-7 w-28 sm:h-9 sm:w-40" />
        <Bone className="h-4 w-20" />
      </div>
      <Bone className="h-[42px] w-[210px] rounded-lg" />
      <SectionLabel />
      <div className="flex flex-col gap-2">
        {ROW_W.map((w, i) => <RowBone key={i} width={w} />)}
      </div>
    </main>
  );
}

export function SettingsSkeleton() {
  return (
    <main className={shell} aria-busy="true" aria-label="Loading settings">
      <div className="py-4 sm:pb-5 sm:pt-6">
        <Bone className="h-7 w-32 sm:h-9 sm:w-44" />
      </div>
      {/* Settings is eight sections deep; standing in for three left the page
          growing under the reader as it loaded. These counts are the real
          ones — Appearance, Calculations, ApoB method, Lp(a), Export, Account,
          Data, Legal. */}
      {[1, 2, 2, 2, 2, 3, 1, 1].map((rows, s) => (
        <section key={s}>
          <SectionLabel />
          <div className="tile divide-y divide-line overflow-hidden">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <Bone className="h-4 w-28" />
                  <Bone className="mt-2 h-3.5 w-40" />
                </div>
                <Bone className="h-6 w-16 shrink-0 rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
