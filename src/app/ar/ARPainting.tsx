"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "../../../store/appSlice";
import { messages } from "../../i18n/messages";

interface ARPaintingProps {
  scenes: ReadonlyArray<{ key: string; svgFile: string }>;
  language: Language;
  selectedGroup: string | null;
  onSceneFound: (index: number) => void;
  onSceneLost: (index: number) => void;
  onSelectGroup: (index: number, group: string | null) => void;
}

type TrackingStatus = "loading" | "scanning" | "found" | "error";

type ARRuntime = {
  MindARThree: new (options: Record<string, unknown>) => any;
  CSS3DObject: new (element: HTMLElement) => any;
};

let runtimePromise: Promise<ARRuntime> | null = null;

function loadARRuntime(): Promise<ARRuntime> {
  const arWindow = window as Window & { MemoriseARRuntime?: ARRuntime };
  if (arWindow.MemoriseARRuntime) return Promise.resolve(arWindow.MemoriseARRuntime);
  if (!runtimePromise) {
    runtimePromise = new Promise<ARRuntime>((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/ar-runtime.js";
      script.onload = () => arWindow.MemoriseARRuntime
        ? resolve(arWindow.MemoriseARRuntime)
        : reject(new Error("AR runtime could not be loaded."));
      script.onerror = () => reject(new Error("AR runtime could not be loaded."));
      document.head.appendChild(script);
    }).catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise!;
}

function createInteractiveOverlay(source: string, ariaLabel: string, onSelectGroup: (group: string) => void) {
  const svg = new DOMParser().parseFromString(source, "image/svg+xml").documentElement as unknown as SVGSVGElement;
  svg.querySelectorAll("image:not([id*='hidden'])").forEach((image) => image.remove());
  const viewBox = svg.viewBox.baseVal;
  const height = Math.round(1000 * viewBox.height / viewBox.width);
  svg.setAttribute("width", "1000");
  svg.setAttribute("height", String(height));
  svg.setAttribute("class", "ar-overlay-svg");
  svg.setAttribute("aria-label", ariaLabel);

  svg.querySelectorAll("path").forEach((path) => {
    const group = path.closest("g[id$='_group']");
    if (group) {
      path.classList.add("ar-interactive-path");
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute("aria-label", group.id.replace(/_x5F_group$/, "").replace(/_group$/, ""));
    }
  });

  const wrapper = document.createElement("div");
  wrapper.className = "ar-overlay";
  wrapper.style.width = "1000px";
  wrapper.style.height = `${height}px`;
  wrapper.appendChild(svg);

  const select = (target: EventTarget | null) => {
    if (!(target instanceof SVGPathElement) || !target.classList.contains("ar-interactive-path")) return;
    const group = target.closest("g[id$='_group']");
    if (group?.id) onSelectGroup(group.id);
  };
  wrapper.addEventListener("click", (event) => select(event.target));
  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(event.target);
    }
  });
  return { wrapper, svg };
}

export function ARPainting({ scenes, language, selectedGroup, onSceneFound, onSceneLost, onSelectGroup }: ARPaintingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlaysRef = useRef<SVGSVGElement[]>([]);
  const selectRef = useRef(onSelectGroup);
  const sceneFoundRef = useRef(onSceneFound);
  const sceneLostRef = useRef(onSceneLost);
  const [status, setStatus] = useState<TrackingStatus>("loading");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ui = messages[language].ar;

  useEffect(() => { selectRef.current = onSelectGroup; }, [onSelectGroup]);
  useEffect(() => { sceneFoundRef.current = onSceneFound; }, [onSceneFound]);
  useEffect(() => { sceneLostRef.current = onSceneLost; }, [onSceneLost]);

  useEffect(() => {
    overlaysRef.current.forEach((svg) => {
      svg.querySelectorAll("g.ar-selected").forEach((group) => group.classList.remove("ar-selected"));
    });
    const svg = activeIndex == null ? null : overlaysRef.current[activeIndex];
    if (svg && selectedGroup) {
      const group = Array.from(svg.querySelectorAll("g[id$='_group']"))
        .find((element) => element.id === selectedGroup);
      group?.classList.add("ar-selected");
    }
  }, [selectedGroup, activeIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let started = false;
    let mindar: any;
    let foundIndex: number | null = null;
    setStatus("loading");
    setError(null);

    const start = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error(messages[language].ar.secureContext);
        }
        const [sources, runtime] = await Promise.all([
          Promise.all(scenes.map(async ({ svgFile }) => {
            const response = await fetch(svgFile);
            if (!response.ok) throw new Error(messages[language].ar.unavailable);
            return response.text();
          })),
          loadARRuntime(),
        ]);
        if (cancelled) return;
        mindar = new runtime.MindARThree({
          container,
          imageTargetSrc: "/ar-targets/scenes.mind",
          uiLoading: "no",
          uiScanning: "no",
          uiError: "no",
          maxTrack: 1,
        });
        overlaysRef.current = sources.map((source, index) => {
          const interactive = createInteractiveOverlay(source, messages[language].ar.interactiveObjects, (group) => selectRef.current(index, group));
          const anchor = mindar.addCSSAnchor(index);
          anchor.group.add(new runtime.CSS3DObject(interactive.wrapper));
          anchor.onTargetFound = () => {
            if (cancelled) return;
            foundIndex = index;
            setActiveIndex(index);
            setStatus("found");
            sceneFoundRef.current(index);
          };
          anchor.onTargetLost = () => {
            if (cancelled || foundIndex !== index) return;
            foundIndex = null;
            setActiveIndex(null);
            setStatus("scanning");
            sceneLostRef.current(index);
          };
          return interactive.svg;
        });
        setStatus("scanning");
        await mindar.start();
        if (cancelled) {
          mindar.stop();
          return;
        }
        started = true;
        mindar.renderer.setAnimationLoop(() => {
          mindar.renderer.render(mindar.scene, mindar.camera);
          mindar.cssRenderer.render(mindar.cssScene, mindar.camera);
        });
      } catch (cause) {
        mindar?.video?.srcObject?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        if (!cancelled) {
          const message = cause instanceof DOMException && cause.name === "NotAllowedError"
            ? messages[language].ar.cameraDenied
            : cause instanceof DOMException && cause.name === "NotFoundError"
              ? messages[language].ar.noCamera
              : cause instanceof Error && cause.message === messages[language].ar.secureContext
                ? cause.message
                : messages[language].ar.unavailable;
          setError(message);
          setStatus("error");
        }
      }
    };
    void start();

    return () => {
      cancelled = true;
      overlaysRef.current = [];
      if (mindar) {
        mindar.renderer.setAnimationLoop(null);
        if (started) mindar.stop();
        else mindar.video?.srcObject?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        mindar.renderer.dispose();
      }
      container.replaceChildren();
    };
  }, [scenes, language]);

  return (
    <div className="ar-stage size-full relative bg-black">
      <div ref={containerRef} className="ar-camera size-full overflow-hidden" />
      {status !== "found" && (
        <div className="ar-guidance" role="status">
          <p>{status === "loading" ? ui.loading : status === "error" ? (error ?? ui.unavailable) : ui.scan}</p>
        </div>
      )}
      {status === "found" && selectedGroup && (
        <button className="ar-clear interface-pill-button" type="button" onClick={() => { if (activeIndex != null) selectRef.current(activeIndex, null); }}>
          {ui.clearSelection}
        </button>
      )}
    </div>
  );
}
