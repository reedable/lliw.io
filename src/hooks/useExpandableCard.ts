import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/** Must match the card geometry transition in PaletteCard.module.css. */
export const EXPANDABLE_CARD_TRANSITION_MS = 300;

type Phase = "idle" | "pinned" | "open";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const readRect = (element: Element): Rect => {
  const { top, left, width, height } = element.getBoundingClientRect();
  return { top, left, width, height };
};

/* Evaluates CSS's default `ease`, keeping the scroll unwind in step with the card. */
const ease = (fraction: number): number => {
  const cx = 3 * 0.25;
  const bx = 3 * (0.25 - 0.25) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * 0.1;
  const by = 3 * (1 - 0.1) - cy;
  const ay = 1 - cy - by;

  let lo = 0;
  let hi = 1;
  let t = fraction;
  for (let i = 0; i < 20; i += 1) {
    const x = ((ax * t + bx) * t + cx) * t;
    if (x < fraction) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return ((ay * t + by) * t + cy) * t;
};

/**
 * Lifts an in-flow card to a measured fixed rectangle before expanding it, then
 * reverses the process on close. Keeping both endpoints fixed makes the geometry
 * interpolable; the holder preserves the card's grid row while it is lifted.
 */
export const useExpandableCard = (expanded: boolean) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const unwindRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rect, setRect] = useState<Rect | null>(null);
  const lifted = phase !== "idle";

  useEffect(() => () => cancelAnimationFrame(unwindRef.current), []);

  // Pin before paint so the in-flow-to-fixed switch is invisible.
  useLayoutEffect(() => {
    if (!expanded || phase !== "idle" || !cardRef.current) return;
    cancelAnimationFrame(unwindRef.current);
    setRect(readRect(cardRef.current));
    setPhase("pinned");
  }, [expanded, phase]);

  // Two frames ensure the pinned rectangle is painted before it expands.
  useEffect(() => {
    if (!expanded || phase !== "pinned") return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [expanded, phase]);

  // Aim at the holder and unwind its scroller while the geometry contracts.
  useLayoutEffect(() => {
    if (expanded || phase !== "open") return;
    if (!holderRef.current) {
      setPhase("idle");
      setRect(null);
      return;
    }
    setRect(readRect(holderRef.current));
    setPhase("pinned");

    const content = contentRef.current;
    const from = content?.scrollTop ?? 0;
    if (!content || from === 0) return;

    cancelAnimationFrame(unwindRef.current);
    const start = performance.now();
    unwindRef.current = requestAnimationFrame(function step(now) {
      const fraction = Math.min(1, (now - start) / EXPANDABLE_CARD_TRANSITION_MS);
      content.scrollTop = from * (1 - ease(fraction));
      if (fraction < 1) unwindRef.current = requestAnimationFrame(step);
    });
  }, [expanded, phase]);

  // Drop fixed geometry only after it reaches the measured row rectangle.
  useEffect(() => {
    if (expanded || phase !== "pinned") return;
    const timer = setTimeout(() => {
      setPhase("idle");
      setRect(null);
    }, EXPANDABLE_CARD_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [expanded, phase]);

  const style: CSSProperties =
    phase === "idle" || !rect
      ? {}
      : phase === "open"
        ? { position: "fixed", margin: 0, top: 0, left: 0, width: "100vw", height: "100dvh" }
        : {
            position: "fixed",
            margin: 0,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };

  return { cardRef, holderRef, contentRef, lifted, phase, style };
};
