"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import type { Box, PageSource } from "@/lib/formats";
import type { View } from "@/lib/views";
import { PageView, Ribbon } from "./page-view";

export interface StageHandle {
  turn(delta: number): void;
}

interface Turn {
  from: number;
  to: number;
  duration: number;
}

const TURN_MS = 450;
const QUEUED_TURN_MS = 260;
const EASING = "cubic-bezier(.3,.7,.4,1)";
const SWIPE_PX = 40;
const TAP_SLOP = 8;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

function Slot({
  source,
  page,
  box,
  version,
  side,
  bookmarked,
}: {
  source: PageSource;
  page: number | null;
  box: Box;
  version: number;
  side?: "left" | "right";
  bookmarked: boolean;
}) {
  return (
    <div
      className={`relative shrink-0 ${side ? `spread-${side}` : ""} ${
        page !== null ? "shadow-[0_10px_40px_-18px_var(--shade)]" : ""
      }`}
      style={{ width: box.width, height: box.height }}
    >
      {page !== null && (
        <>
          <PageView source={source} index={page} box={box} version={version} />
          {bookmarked && <Ribbon />}
        </>
      )}
    </div>
  );
}

function Face({
  source,
  page,
  box,
  version,
  back,
  side,
  shadeRef,
}: {
  source: PageSource;
  page: number | null;
  box: Box;
  version: number;
  back?: boolean;
  side?: "left" | "right";
  shadeRef: Ref<HTMLDivElement>;
}) {
  return (
    <div className={`leaf-face ${back ? "back" : ""} ${side ? `spread-${side}` : ""}`}>
      {page !== null && <PageView source={source} index={page} box={box} version={version} />}
      <div
        ref={shadeRef}
        className="leaf-shade"
        style={{
          background: `linear-gradient(${back ? "to right" : "to left"}, transparent 10%, var(--shade))`,
        }}
      />
    </div>
  );
}

interface GestureState {
  kind: "tap" | "pinch" | "done";
  x: number;
  y: number;
  scrollLeft: number;
  scrollTop: number;
  moved: boolean;
  startDist: number;
  scale: number;
  mid: { x: number; y: number };
}

/**
 * The paged layouts: one page or a spread, with 3D page turns, tap zones,
 * swipes, and (for PDF) panning and pinch zoom.
 */
export function Stage({
  ref,
  source,
  views,
  viewIndex,
  box,
  spread,
  version,
  bookmarked,
  canPan,
  onViewChange,
  onCenterTap,
  onPinch,
}: {
  ref: Ref<StageHandle>;
  source: PageSource;
  views: View[];
  viewIndex: number;
  box: Box;
  spread: boolean;
  version: number;
  bookmarked: Set<number>;
  /** The content is larger than the screen: drags pan instead of turning. */
  canPan: boolean;
  onViewChange: (index: number) => void;
  onCenterTap: () => void;
  onPinch?: (scale: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [turn, setTurn] = useState<Turn | null>(null);
  const settled = useRef(viewIndex);
  const turning = useRef<Turn | null>(null);
  const queued = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const leaf = useRef<HTMLDivElement>(null);
  const frontShade = useRef<HTMLDivElement>(null);
  const backShade = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<GestureState | null>(null);
  const pinchAnchor = useRef<{ x: number; y: number; ratio: number } | null>(null);
  const lastBox = useRef(box);

  useEffect(() => {
    if (!turning.current) settled.current = viewIndex;
  }, [viewIndex]);

  // A new pagination invalidates view indexes, so drop any turn in flight.
  useEffect(() => {
    turning.current = null;
    queued.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on re-pagination
    setTurn(null);
  }, [views]);

  const startTurn = useCallback((from: number, to: number, duration: number) => {
    const next = { from, to, duration };
    turning.current = next;
    setTurn(next);
  }, []);

  const turnBy = useCallback(
    (delta: number) => {
      const base = queued.current ?? turning.current?.to ?? settled.current;
      const target = Math.min(views.length - 1, Math.max(0, base + delta));
      if (target === base) return;
      if (turning.current) {
        queued.current = target;
        return;
      }
      if (reduceMotion) {
        settled.current = target;
        onViewChange(target);
        return;
      }
      startTurn(settled.current, target, TURN_MS);
    },
    [views.length, reduceMotion, onViewChange, startTurn],
  );

  useImperativeHandle(ref, () => ({ turn: turnBy }), [turnBy]);

  useLayoutEffect(() => {
    if (!turn || !leaf.current) return;
    const forward = turn.to > turn.from;
    const frames = forward
      ? ["rotateY(0deg)", "rotateY(-180deg)"]
      : spread
        ? ["rotateY(0deg)", "rotateY(180deg)"]
        : ["rotateY(-180deg)", "rotateY(0deg)"];
    const options: KeyframeAnimationOptions = { duration: turn.duration, easing: EASING, fill: "forwards" };
    const animations = [
      leaf.current.animate(frames.map((transform) => ({ transform })), options),
      frontShade.current?.animate([{ opacity: 0 }, { opacity: 0.85 }], options),
      backShade.current?.animate([{ opacity: 0.85 }, { opacity: 0 }], options),
    ];
    let cancelled = false;
    animations[0]!.finished.then(
      () => {
        if (cancelled) return;
        turning.current = null;
        settled.current = turn.to;
        onViewChange(turn.to);
        const next = queued.current;
        queued.current = null;
        if (next !== null && next !== turn.to) startTurn(turn.to, next, QUEUED_TURN_MS);
        else setTurn(null);
      },
      () => {},
    );
    return () => {
      cancelled = true;
      animations.forEach((a) => a?.cancel());
    };
  }, [turn, spread, onViewChange, startTurn]);

  // Turning while zoomed shows the new page from its top.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [viewIndex]);

  // After a pinch, keep the content under the fingers in place.
  useLayoutEffect(() => {
    const el = scroller.current;
    const anchor = pinchAnchor.current;
    if (el && anchor && lastBox.current.width !== box.width) {
      el.scrollLeft = (el.scrollLeft + anchor.x) * anchor.ratio - anchor.x;
      el.scrollTop = (el.scrollTop + anchor.y) * anchor.ratio - anchor.y;
      pinchAnchor.current = null;
    }
    lastBox.current = box;
  }, [box]);

  const resetPinch = () => {
    if (row.current) row.current.style.transform = "";
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = scroller.current!;
    if (pointers.current.size === 1) {
      gesture.current = {
        kind: "tap",
        x: e.clientX,
        y: e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        moved: false,
        startDist: 0,
        scale: 1,
        mid: { x: 0, y: 0 },
      };
    } else if (pointers.current.size === 2 && onPinch && !turning.current) {
      const [a, b] = Array.from(pointers.current.values());
      const rect = el.getBoundingClientRect();
      gesture.current = {
        ...gesture.current!,
        kind: "pinch",
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: 1,
        mid: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const el = scroller.current;
    if (!g || !el) return;
    if (g.kind === "pinch" && pointers.current.size === 2 && row.current) {
      const [a, b] = Array.from(pointers.current.values());
      g.scale = Math.hypot(a.x - b.x, a.y - b.y) / g.startDist;
      const rowRect = row.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const ox = g.mid.x + elRect.left - rowRect.left;
      const oy = g.mid.y + elRect.top - rowRect.top;
      row.current.style.transformOrigin = `${ox}px ${oy}px`;
      row.current.style.transform = `scale(${g.scale})`;
    } else if (g.kind === "tap") {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) g.moved = true;
      if (canPan) {
        el.scrollLeft = g.scrollLeft - dx;
        el.scrollTop = g.scrollTop - dy;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    const el = scroller.current;
    if (!g || !el) return;
    if (g.kind === "pinch") {
      resetPinch();
      if (e.type !== "pointercancel" && Math.abs(g.scale - 1) > 0.02) {
        pinchAnchor.current = { x: g.mid.x, y: g.mid.y, ratio: g.scale };
        onPinch?.(g.scale);
      }
      g.kind = "done";
      return;
    }
    if (g.kind !== "tap" || pointers.current.size > 0 || e.type === "pointercancel") return;
    gesture.current = null;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved) {
      const rect = el.getBoundingClientRect();
      const fraction = (e.clientX - rect.left) / rect.width;
      if (fraction < 0.3) turnBy(-1);
      else if (fraction > 0.7) turnBy(1);
      else onCenterTap();
    } else if (!canPan && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      turnBy(dx < 0 ? 1 : -1);
    }
  };

  const valid = turn && views[turn.from] && views[turn.to];
  const forward = valid ? turn.to > turn.from : true;
  let base: View = views[viewIndex] ?? [];
  let front: number | null = null;
  let back: number | null = null;
  if (valid) {
    const a = views[turn.from];
    const b = views[turn.to];
    if (spread) {
      base = forward ? [a[0], b[1]] : [b[0], a[1]];
      front = forward ? a[1] : a[0];
      back = forward ? b[0] : b[1];
    } else {
      base = forward ? b : a;
      front = forward ? a[0] : b[0];
    }
  }

  const leafStyle: React.CSSProperties = !spread
    ? { left: 0, width: "100%", transformOrigin: "left center", transform: forward ? undefined : "rotateY(-180deg)" }
    : forward
      ? { left: "50%", width: "50%", transformOrigin: "left center" }
      : { left: 0, width: "50%", transformOrigin: "right center" };

  return (
    <div
      ref={scroller}
      className="absolute inset-0 touch-none overflow-auto overscroll-none select-none [scrollbar-width:thin]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => (e.nativeEvent as PointerEvent).pointerType === "touch" && e.preventDefault()}
    >
      <div className="flex min-h-full min-w-full p-3">
        <div ref={row} className="relative m-auto flex" style={{ perspective: "2400px" }}>
          {spread ? (
            <>
              <Slot source={source} page={base[0] ?? null} box={box} version={version} side="left" bookmarked={bookmarked.has(base[0] ?? -1)} />
              <Slot source={source} page={base[1] ?? null} box={box} version={version} side="right" bookmarked={bookmarked.has(base[1] ?? -1)} />
            </>
          ) : (
            <Slot source={source} page={base[0] ?? null} box={box} version={version} bookmarked={bookmarked.has(base[0] ?? -1)} />
          )}
          {valid && (
            <div ref={leaf} className="leaf" style={leafStyle}>
              <Face
                source={source}
                page={front}
                box={box}
                version={version}
                side={spread ? (forward ? "right" : "left") : undefined}
                shadeRef={frontShade}
              />
              <Face
                source={source}
                page={back}
                box={box}
                version={version}
                back
                side={spread ? (forward ? "left" : "right") : undefined}
                shadeRef={backShade}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
