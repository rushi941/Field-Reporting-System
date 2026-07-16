import { useEffect, useState } from "react";
import { Cone, Paintbrush, Signpost } from "lucide-react";
import { cn } from "@/lib/utils";

const slides = [
  {
    id: "marking",
    eyebrow: "Pavement Marking",
    title: "Lane lines that keep America moving",
    body: "Capture daily LF, STA ranges, and tickets from the stripe truck — ready for pay-app backup.",
    icon: Paintbrush,
    motif: "stripes",
  },
  {
    id: "traffic",
    eyebrow: "Traffic Control",
    title: "Work zones, certified and accountable",
    body: "Log setups, certifications, and crew notes so office billing never chases missing docs.",
    icon: Cone,
    motif: "cones",
  },
  {
    id: "signs",
    eyebrow: "Permanent Signs",
    title: "Every post, every station, verified",
    body: "Point-location quantities and photos tied to bid items for clean progress billing.",
    icon: Signpost,
    motif: "signs",
  },
] as const;

export function LoginHeroSlider({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5600);
    return () => window.clearInterval(id);
  }, []);

  const slide = slides[index];
  const Icon = slide.icon;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[220px] flex-col overflow-hidden bg-asphalt text-primary-foreground",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="absolute inset-y-0 left-[14%] w-px bg-white/[0.08]" />
        <div className="absolute inset-y-0 left-[16.5%] w-1.5 lane-scroll opacity-80" />
        <div className="absolute inset-y-0 right-[14%] w-px bg-white/[0.08]" />
        <div
          className="absolute -right-10 top-16 h-56 w-56 rounded-full bg-lane/15 blur-3xl"
          style={{ animation: "pulse-glow 5s ease-in-out infinite" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/35 to-transparent" />
      </div>

      {slide.motif === "cones" && (
        <div className="pointer-events-none absolute bottom-16 right-12 flex gap-3 opacity-20">
          {[0, 1, 2].map((n) => (
            <div
              key={n}
              className="h-16 w-10 origin-bottom rounded-sm bg-gradient-to-b from-orange-400 to-orange-700"
              style={{ transform: `skewX(-8deg) translateY(${n * 4}px)` }}
            />
          ))}
        </div>
      )}

      {slide.motif === "signs" && (
        <div className="pointer-events-none absolute right-14 top-28 opacity-15">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-lane bg-asphalt-mid font-display text-2xl text-lane">
            ➔
          </div>
          <div className="mx-auto mt-1 h-28 w-1.5 bg-steel/50" />
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col justify-between px-10 py-10 xl:px-14 xl:py-12">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-lane">
          <span className="inline-block h-1 w-8 bg-lane" />
          USA Road Contractors
        </div>

        <div
          key={slide.id}
          className="animate-slide-fade max-w-lg space-y-5 py-10"
        >
          <div className="inline-flex items-center gap-2 rounded border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-steel">
            <Icon className="size-3.5 text-lane" />
            {slide.eyebrow}
          </div>
          <h2 className="font-display text-4xl font-semibold leading-[1.12] tracking-tight text-white xl:text-[2.85rem]">
            {slide.title}
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-steel">
            {slide.body}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            <span className="text-lane">Field</span>
            <span className="text-white/25">→</span>
            <span className="text-lane">Approve</span>
            <span className="text-white/25">→</span>
            <span className="text-lane">Bill</span>
          </div>

          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index
                    ? "w-9 bg-lane"
                    : "w-3 bg-white/25 hover:bg-white/45",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
