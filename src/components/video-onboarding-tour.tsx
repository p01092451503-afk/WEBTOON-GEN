import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clapperboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pilottoon.video-tour.v1";

const STEPS = [
  {
    selector: '[data-video-tour="references"]',
    title: "Add references if you have them",
    description:
      "Images guide the subject and look. Videos guide motion and camera behavior. You can also create from text only.",
  },
  {
    selector: '[data-video-tour="prompt"]',
    title: "Describe your video",
    description:
      "Write naturally in Korean or English. Describe who appears, what happens, and the mood you want.",
  },
  {
    selector: '[data-video-tour="generate"]',
    title: "Generate with one click",
    description:
      "pilottoon studies your references, enhances the prompt, and selects an available engine automatically.",
  },
  {
    selector: '[data-video-tour="result"]',
    title: "Review and download",
    description:
      "Your finished video appears here. Play it, download it, or inspect the enhanced prompt.",
  },
] as const;

type Rect = { top: number; left: number; width: number; height: number };

export function VideoOnboardingTour({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const target = document.querySelector(STEPS[step].selector);
      if (!(target instanceof HTMLElement)) {
        setRect(null);
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      window.setTimeout(() => {
        const next = target.getBoundingClientRect();
        setRect({ top: next.top, left: next.left, width: next.width, height: next.height });
      }, 350);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function finish() {
    window.localStorage.setItem(STORAGE_KEY, "completed");
    onOpenChange(false);
    setStep(0);
  }

  if (!open) return null;
  const current = STEPS[step];
  const tooltipTop = rect
    ? rect.top + rect.height + 16 + 310 < window.innerHeight
      ? rect.top + rect.height + 16
      : Math.max(16, rect.top - 286)
    : window.innerHeight / 2 - 140;
  const tooltipLeft = rect
    ? Math.min(Math.max(16, rect.left), window.innerWidth - Math.min(400, window.innerWidth - 32) - 16)
    : Math.max(16, window.innerWidth / 2 - 200);

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Video Studio onboarding tour">
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-4 ring-primary ring-offset-4 ring-offset-background shadow-[0_0_0_9999px_color-mix(in_oklch,var(--color-foreground)_58%,transparent)] transition-all duration-300"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div className="fixed inset-0 bg-foreground/60" />
      )}

      <div
        className="fixed w-[calc(100vw-2rem)] max-w-[400px] rounded-2xl border border-primary/15 bg-primary-soft p-5 text-popover-foreground shadow-toss-lg"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Clapperboard className="h-5 w-5" />
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={finish} aria-label="Close tour">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-4 text-[11px] font-bold uppercase text-primary">Step {step + 1} of {STEPS.length}</p>
        <h2 className="mt-1 text-lg font-bold">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.description}</p>

        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span key={index} className={index === step ? "h-1.5 w-7 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full bg-border"} />
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={finish}>Skip tour</Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep((value) => value - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => (step === STEPS.length - 1 ? finish() : setStep((value) => value + 1))}
            >
              {step === STEPS.length - 1 ? <><Check className="h-4 w-4" /> Done</> : <>Next <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function shouldStartVideoTour() {
  return window.localStorage.getItem(STORAGE_KEY) !== "completed";
}