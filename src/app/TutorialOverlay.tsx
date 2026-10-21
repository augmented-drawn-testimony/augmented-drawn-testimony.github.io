"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { State } from "../../store/store";
import { messages } from "../i18n/messages";

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface TutorialStep {
  selector: string;
  eyebrow: string;
  title: string;
  description: string;
  targetPoint: { x: number; y: number };
  offset?: { x: number; y: number };
}

interface TutorialLayout {
  target: DOMRect;
  card: { left: number; top: number; width: number; height: number };
  arrow: { startX: number; startY: number; endX: number; endY: number };
}

const stepLayouts: Array<
  Pick<TutorialStep, "selector" | "targetPoint" | "offset">
> = [
  {
    selector: '[data-tutorial="painting"]',
    targetPoint: { x: 0.28, y: 0.38 },
  },
  {
    selector: '[data-tutorial="story"]',
    targetPoint: { x: 0.5, y: 0.4 },
  },
  {
    selector: '[data-tutorial="data"]',
    targetPoint: { x: 0.8, y: 1.0 },
    offset: { x: 0.0, y: 1.0 },
  },
  {
    selector: '[data-tutorial="timeline"]',
    targetPoint: { x: 0.5, y: 0.5 },
  },
];

const CARD_WIDTH = 340;
const CARD_HEIGHT = 196;
const EDGE_GAP = 20;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getLayout(step: TutorialStep, stepIndex: number): TutorialLayout | null {
  const element = document.querySelector(step.selector);
  if (element == null) return null;

  const target = element.getBoundingClientRect();
  const width = Math.min(CARD_WIDTH, window.innerWidth - EDGE_GAP * 2);
  const height = CARD_HEIGHT;
  let left: number;
  let top: number;

  if (stepIndex === 0) {
    left = EDGE_GAP + 12;
    top = Math.max(88, target.top + 72);
  } else if (stepIndex === 1) {
    left = target.left + Math.max(16, (target.width - width) / 2);
    top = Math.max(88, target.top + 72);
  } else {
    left = target.left + (target.width - width) / 2;
    top = target.top - height - 28;
  }

  if (step.offset?.x) {
    left = left + CARD_WIDTH * step.offset.x;

  }
  if (step.offset?.y) {
    top = top + CARD_WIDTH * step.offset.y;
  }

  left = clamp(left, EDGE_GAP, window.innerWidth - width - EDGE_GAP);
  top = clamp(top, EDGE_GAP, window.innerHeight - height - EDGE_GAP);

  const endX = target.left + target.width * step.targetPoint.x;
  const endY = target.top + target.height * step.targetPoint.y;
  const cardCenterX = left + width / 2;
  const cardCenterY = top + height / 2;
  const pointsDown = endY > cardCenterY;

  return {
    target,
    card: { left, top, width, height },
    arrow: {
      startX: clamp(endX, left + 34, left + width - 34),
      startY: pointsDown ? top + height + 8 : top - 8,
      endX,
      endY,
    },
  };
}

export function TutorialOverlay({ open, onClose }: TutorialOverlayProps) {
  const language = useSelector((state: State) => state.app.language);
  const ui = messages[language].tutorial;
  const steps = useMemo(
    () =>
      stepLayouts.map((layout, index) => ({
        ...layout,
        ...ui.steps[index],
      })),
    [ui.steps]
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [layout, setLayout] = useState<TutorialLayout | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!open) return;

    setStepIndex(0);
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updateLayout = () => setLayout(getLayout(step, stepIndex));
    updateLayout();
    window.addEventListener("resize", updateLayout);
    const observer = new ResizeObserver(updateLayout);
    const target = document.querySelector(step.selector);
    if (target != null) observer.observe(target);

    return () => {
      window.removeEventListener("resize", updateLayout);
      observer.disconnect();
    };
  }, [open, step, stepIndex]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      }
      if (event.key === "ArrowLeft") {
        setStepIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const arrowPath = useMemo(() => {
    if (layout == null) return "";
    const { startX, startY, endX, endY } = layout.arrow;
    const curveY = startY + (endY - startY) * 0.55;
    return `M ${startX} ${startY} C ${startX} ${curveY}, ${endX} ${curveY}, ${endX} ${endY}`;
  }, [layout]);

  if (!open || layout == null) return null;

  const padding = 8;
  const targetX = Math.max(0, layout.target.left - padding);
  const targetY = Math.max(0, layout.target.top - padding);
  const targetWidth = Math.min(
    window.innerWidth - targetX,
    layout.target.width + padding * 2
  );
  const targetHeight = Math.min(
    window.innerHeight - targetY,
    layout.target.height + padding * 2
  );

  return (
    <div
      className="fixed inset-0 z-[1000] text-gray-950"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      onClick={(event) => event.stopPropagation()}
    >
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <mask id="tutorial-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={targetX}
              y={targetY}
              width={targetWidth}
              height={targetHeight}
              rx="14"
              fill="black"
            />
          </mask>
          {/* <marker
            id="tutorial-arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="black" />
          </marker> */}
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(17, 24, 39, 0.72)"
          mask="url(#tutorial-spotlight-mask)"
        />
        <rect
          x={targetX}
          y={targetY}
          width={targetWidth}
          height={targetHeight}
          rx="14"
          fill="none"
          stroke="rgba(255,255,255,.9)"
          strokeWidth="2"
          className="tutorial-highlight"
        />
        <path
          key={stepIndex}
          d={arrowPath}
          pathLength={1}
          fill="none"
          stroke="black"
          strokeWidth="3"
          strokeLinecap="round"
          markerEnd="url(#tutorial-arrowhead)"
          className="tutorial-arrow"
        />
      </svg>

      <section
        className="absolute rounded-xl border border-white/40 bg-white p-5 shadow-2xl"
        style={{
          left: layout.card.left,
          top: layout.card.top,
          width: layout.card.width,
          minHeight: layout.card.height,
        }}
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              {step.eyebrow} · {stepIndex + 1} {ui.of} {steps.length}
            </p>
            <h2 id="tutorial-title" className="mt-1 text-xl font-semibold">
              {step.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="-mr-2 -mt-2 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-500"
            aria-label={ui.close}
            onClick={onClose}
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>
        <p className="text-sm leading-6 text-gray-700">{step.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => current - 1)}
          >
            <ArrowLeftIcon className="size-4" /> {ui.previous}
          </button>
          {stepIndex < steps.length - 1 ? (
            <button
              type="button"
              className="flex items-center gap-1 rounded-md bg-gray-900 px-3 py-2 text-sm text-white transition hover:bg-gray-700"
              onClick={() => setStepIndex((current) => current + 1)}
            >
              {ui.next} <ArrowRightIcon className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white transition hover:bg-gray-700"
              onClick={onClose}
            >
              {ui.startExploring}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
