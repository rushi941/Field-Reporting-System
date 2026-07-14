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
    }, 5200);
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
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute inset-y-0 left-[18%] w-px bg-white/10" />
        <div className="absolute inset-y-0 left-[22%] w-1.5 lane-scroll opacity-90" />
        <div className="absolute inset-y-0 right-[18%] w-px bg-white/10" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
        <div
          className="absolute -right-16 top-10 h-40 w-40 rounded-full bg-lane/20 blur-3xl"
          style={{ animation: "pulse-glow 4s ease-in-out infinite" }}
        />
      </div>

      {slide.motif === "cones" && (
        <div className="pointer-events-none absolute bottom-8 right-8 flex gap-3 opacity-25">
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
        <div className="pointer-events-none absolute right-10 top-24 opacity-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-lane bg-asphalt-mid font-display text-2xl text-lane">
            ➔
          </div>
          <div className="mx-auto mt-1 h-24 w-1.5 bg-steel/60" />
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col justify-between p-6 sm:p-8 lg:p-10">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-lane">
          <span className="inline-block h-1.5 w-6 bg-lane" />
          USA Road Contractors
        </div>

        <div key={slide.id} className="animate-slide-fade max-w-md space-y-4 py-8">
          <div className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-steel">
            <Icon className="size-3.5 text-lane" />
            {slide.eyebrow}
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-[2.65rem]">
            {slide.title}
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-steel sm:text-base">
            {slide.body}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-8 bg-lane" : "w-3 bg-white/25 hover:bg-white/40",
                )}
              />
            ))}
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            Field → Approve → Bill
          </p>
        </div>
      </div>
    </div>
  );
}
