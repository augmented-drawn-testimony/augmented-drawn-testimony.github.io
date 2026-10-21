"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SVG from "react-inlinesvg";
import { useDispatch, useSelector } from "react-redux";
import { setSelectedGroup } from "../../../store/appSlice";
import { nanoid } from "@reduxjs/toolkit";
import { State } from "../../../store/store";
// import MySVG from "../../../public/assets/6000px Ervin Abadi Perpective view B-B all duplicated layers 2.svg";
// import explorationDataEn from "../locales/en/translation.json";
// import { PaintingContext } from "./painting.context";
// import shortid from "shortid";
// import { useTranslation } from "react-i18next";

const storyPathMapping = {
  kitchen: "path310",
  fences: "g304",
  food: "path319",
  watchtower: "path358",
  guards: "g763",
  barracks: "path230",
  inmates: "g339",
  documentation: "path224",
} as Record<string, string>;

const pathStoryMapping = {
  path310: "kitchen",
  g304: "fences",
  path319: "food",
  guard_tower_centre_Image_copy: "watchtower",
  g763: "guards",
  g242: "barracks",
  g339: "inmates",
  writing_Image_copy: "documentation",
} as Record<string, string>;

const strokeBlinkIntervalMs = 5000;
const strokeBlinkStaggerMs = 150;

export function getSvgDimensionsFromString(svgString: string) {
  const readAttr = (name: string) => {
    const regex = new RegExp(`${name}\\s*=\\s*"([^"]+)"`);
    const match = svgString.match(regex);
    return match ? parseFloat(match[1]) : undefined;
  };

  let width = readAttr("width");
  let height = readAttr("height");

  // If width or height are missing, fallback to viewBox
  if (width == null || height == null) {
    const viewBoxMatch = svgString.match(/viewBox\s*=\s*"([^"]+)"/);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1]
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (parts.length === 4) {
        const [, , vbWidth, vbHeight] = parts;
        if (width == null) width = vbWidth;
        if (height == null) height = vbHeight;
      }
    }
  }

  return { width, height };
}

export interface PaintingProps {
  svgFile: string;
  inactive?: boolean;
  discoveredStoryKeys?: Array<string>;
  missingSvgPath?: string;
}

export default function Painting(props: PaintingProps) {
  const { svgFile, inactive = false } = props;

  if (svgFile == null) {
    return <div>{props.missingSvgPath ?? "No SVG path was provided."}</div>;
  }

  const dispatch = useDispatch();

  /* const [MySVG, setMySVG] = useState(null);

  useEffect(() => {
    fetch(svgFile)
      .then((res) => res.json())
      .then((res) => {
        setMySVG(res);
      });
  }, [svgFile]);

  console.log("MySVG", MySVG); */

  const svgRef = useRef(null);
  const blinkTimeoutIdsRef = useRef<number[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  // const paintingContext = useContext(PaintingContext);
  // const [paintingSizeByWidth, setPaintingSizeByWidth] =
  //   useState<boolean>(false);

  // const { i18n } = useTranslation();

  // const explorationData = useMemo(() => {
  //   return explorationDataEn["detail-mode"];
  // }, [explorationDataEn]);

  // Zoom function
  const zoomToElement = (elementId: string) => {
    if (svgRef.current != null) {
      const svg = (svgRef.current as SVGGraphicsElement).querySelector("svg");
      const element = document.getElementById(elementId) as unknown;

      const elems = document.querySelectorAll(".highlighted");
      [].forEach.call(elems, function (el) {
        (el as HTMLElement).classList.remove("highlighted");
      });

      if (element != null && svg) {
        (element as HTMLElement).classList.add("highlighted");
        const zoomTarget =
          ((element as SVGGraphicsElement).closest(
            "g[id$='_group']"
          ) as SVGGraphicsElement | null) ?? (element as SVGGraphicsElement);
        const bbox = zoomTarget.getBBox();
        const padding =
          (parseInt(svg.getAttribute("width") as string) / 200) * 10;

        const x = bbox.x - padding;
        const y = bbox.y - padding;
        const width = bbox.width + 2 * padding;
        const height = bbox.height + 2 * padding;

        animateViewBox(svg, getViewBoxArray(svg), [x, y, width, height], 500);
      }
    }
  };

  const resetView = () => {
    if (svgRef.current != null) {
      resetSelectedElements();

      const rec = (svgRef.current as SVGGraphicsElement).querySelector(
        "#viewbox-rect"
      );
      const svg = (svgRef.current as SVGGraphicsElement).querySelector("svg");
      if (rec != null && svg != null) {
        const width = rec.getAttribute("width");
        const height = rec.getAttribute("height");

        animateViewBox(svg, getViewBoxArray(svg), [0, 0, width, height], 500);
      }
    }
  };

  // Helper functions for viewBox animation
  const getViewBoxArray = (svg: SVGSVGElement) => {
    if (svg != null) {
      return svg.getAttribute("viewBox")?.split(" ")?.map(Number);
    }
  };

  /*   const startBlinking = () => {
    const elems = document.querySelectorAll(".myPath");

    elems.forEach((el, index) => {
      setTimeout(() => {
        (el as HTMLElement).classList.add("fade-stroke-animation");
        setTimeout(() => {
          (el as HTMLElement).classList.remove("fade-stroke-animation");
        }, 1999);
      }, index * 2000);
    });
  }; */

  const clearBlinkTimeouts = useCallback(() => {
    blinkTimeoutIdsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    blinkTimeoutIdsRef.current = [];
  }, []);

  const blinkStrokes = useCallback(() => {
    clearBlinkTimeouts();

    const wrapper = svgRef.current as HTMLElement | null;
    if (wrapper == null) {
      return;
    }

    const elems = wrapper.querySelectorAll<SVGGraphicsElement>(".myPath");
    /*  console.log(
      Array.from(elems).sort((a, b) => {
        return (
          (a as HTMLElement).getBoundingClientRect().x -
          (b as HTMLElement).getBoundingClientRect().x
        );
      })
    ); */

    const sortedElements = Array.from(elems).sort((a, b) => {
      return a.getBoundingClientRect().x - b.getBoundingClientRect().x;
    });

    sortedElements.forEach((element) => {
      element.classList.remove("fade-stroke-animation");
    });

    // Commit the removals before the first element is re-added at 0 ms.
    // Otherwise browsers can batch both class changes and skip its animation.
    void wrapper.getBoundingClientRect();

    sortedElements.forEach((el, index) => {
      const timeoutId = window.setTimeout(() => {
        if (el.isConnected) {
          el.classList.add("fade-stroke-animation");
        }
      }, index * strokeBlinkStaggerMs);
      blinkTimeoutIdsRef.current.push(timeoutId);
    });
  }, [clearBlinkTimeouts]);

  const animateViewBox = (
    svg: SVGSVGElement,
    startViewBox: any,
    endViewBox: any,
    duration: any
  ) => {
    let startTime: number | null = null;

    const animateStep = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      const currentViewBox = startViewBox.map(
        (start: number, i: number) => start + (endViewBox[i] - start) * progress
      );

      svg.setAttribute("viewBox", currentViewBox.join(" "));

      if (progress < 1) {
        requestAnimationFrame(animateStep);
      }
    };

    requestAnimationFrame(animateStep);
  };

  const resetSelectedElements = useCallback(() => {
    const svg = svgRef.current as SVGSVGElement | null;
    if (svg == null) {
      dispatch(setSelectedGroup(null));
      return;
    }

    const selected = svg.querySelectorAll(".selected");

    selected.forEach((element) => {
      (element as SVGSVGElement).classList.remove("selected");
    });

    dispatch(setSelectedGroup(null));
  }, [dispatch]);

  // useEffect(() => {
  //   if (svgRef.current) {
  //     const circleElements = (svgRef.current as SVGSVGElement).querySelectorAll(
  //       ".cls-2"
  //     );

  //     const images = (svgRef.current as SVGSVGElement).querySelectorAll(
  //       "image"
  //     );

  //     /* startBlinking();
  //     setInterval(
  //       startBlinking,
  //       document.querySelectorAll(".cls-2").length * 2000
  //     );*/

  function setHiddenImages(group: SVGElement, hidden: boolean) {
    const images = group.querySelectorAll("image");
    images.forEach((element) => {
      if ((element as SVGImageElement).id.includes("hidden")) {
        if (hidden) {
          (element as SVGImageElement).classList.add("hidden");
        } else {
          (element as SVGImageElement).classList.remove("hidden");
        }
      }
    });
  }

  function setupShadowlessElements(group: SVGElement) {
    const elements = group.querySelectorAll("*");
    elements.forEach((element) => {
      if ((element as SVGElement).id.includes("shadowless")) {
        (element as SVGElement).classList.add("shadowless");
      }
    });
  }

  function clickInteractiveElement(e: SVGPathElement) {
    resetSelectedElements();

    const clickedID = e.id;
    const group = e.closest("g[id$='_group']") as SVGElement | null;

    if (group == null) {
      return;
    }

    group.classList.add("selected");

    setupShadowlessElements(group as unknown as SVGElement);
    setHiddenImages(group as unknown as SVGElement, false);
    dispatch(setSelectedGroup(group.id));

    if (clickedID !== "") {
      zoomToElement(clickedID);
    }
  }

  const clickHandler = (e: Event) => {
    e.stopImmediatePropagation();
    if (e.target != null) {
      clickInteractiveElement(e.target as SVGPathElement);
    }
  };

  //     if (circleElements) {
  //       circleElements.forEach((element) => {
  //         element.addEventListener("click", clickHandler);
  //       });
  //     }

  //     // Cleanup listeners on unmount
  //     return () => {
  //       if (circleElements) {
  //         circleElements.forEach((element) => {
  //           element.removeEventListener("click", clickHandler);
  //         });
  //       }
  //     };
  //   }
  // }, [paintingContext?.mode, explorationData]);

  // useEffect(() => {
  //   if (paintingContext?.mode === "exploration") {
  //     resetView();
  //   } else if (
  //     paintingContext?.mode === "story" &&
  //     paintingContext?.storyElement != null
  //   ) {
  //     zoomToElement(storyPathMapping[paintingContext?.storyElement as string]);
  //   }
  // }, [paintingContext?.storyElement, paintingContext?.mode]);

  // const getId = () => {
  //   const id = shortid.generate();
  //   return id;
  // };

  // const pointerLine = useMemo(() => {
  //   if (
  //     paintingContext?.mode === "story" &&
  //     paintingContext?.storyElement != null
  //   ) {
  //     return (
  //       <div
  //         key={`pointer-${getId()}-story`}
  //         className="absolute h-[5px] w-1/2 top-1/2 z-50 reveal"
  //       ></div>
  //     );
  //   } else if (paintingContext?.mode === "detail") {
  //     return (
  //       <div
  //         key={`pointer-${getId()}-detail`}
  //         className="absolute h-[5px] w-1/2 top-1/2 z-50 reveal"
  //       ></div>
  //     );
  //   } else {
  //     return <></>;
  //   }
  // }, [paintingContext?.mode, paintingContext?.storyElement]);

  // useEffect(() => {
  //   function handleResize() {
  //     if (svgRef.current != null) {
  //       const htmlEl = svgRef.current as HTMLElement;
  //       if (htmlEl.clientWidth > htmlEl.clientHeight) {
  //         if (paintingSizeByWidth === true) {
  //           setPaintingSizeByWidth(false);
  //         }
  //       } else {
  //         if (paintingSizeByWidth === false) {
  //           setPaintingSizeByWidth(true);
  //         }
  //       }
  //     }
  //   }

  //   window.addEventListener("resize", handleResize);

  //   return () => {
  //     window.removeEventListener("resize", handleResize);
  //   };
  // }, [svgRef, paintingSizeByWidth]);

  // useEffect(() => {
  //   if (svgRef.current != null) {
  //     const paths = (svgRef.current as SVGSVGElement).querySelectorAll("path");
  //     console.log("UPDATE CURRENT", paths);
  //     paths.forEach((element) => {
  //       element.classList.add("myPath");
  //       element.addEventListener("click", clickHandler);
  //     });
  //   }
  // }, [svgRef.current]);

  useEffect(() => {
    if (svgRef.current != null) {
      setHiddenImages(svgRef.current as SVGSVGElement, true);

      if (inactive !== true) {
        const groups = (svgRef.current as SVGSVGElement).querySelectorAll("g");
        groups.forEach((element) => {
          if (element.id.includes("_group")) {
            const images = (element as SVGSVGElement).querySelectorAll("image");
            const paths = (element as SVGSVGElement).querySelectorAll("path");
            if (paths) {
              images.forEach((img) => {
                img.classList.add("myimage");
              });
            }
          }
        });
      }

      const paths = (svgRef.current as SVGSVGElement).querySelectorAll("path");
      paths.forEach((element) => {
        if (!element.id) {
          element.id = nanoid(4);
        }
        if (inactive !== true) {
          element.classList.add("myPath");
          element.setAttribute("opacity", "1.0");
          element.addEventListener("click", clickHandler);
        }
      });

      resetView();
    }
  }, [svgRef.current, loaded]);

  useEffect(() => {
    if (
      !loaded ||
      inactive ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    blinkStrokes();
    const intervalId = window.setInterval(
      blinkStrokes,
      strokeBlinkIntervalMs
    );

    return () => {
      window.clearInterval(intervalId);
      clearBlinkTimeouts();

      const wrapper = svgRef.current as HTMLElement | null;
      wrapper
        ?.querySelectorAll(".fade-stroke-animation")
        .forEach((element) =>
          element.classList.remove("fade-stroke-animation")
        );
    };
  }, [blinkStrokes, clearBlinkTimeouts, inactive, loaded]);

  const selectedGroup = useSelector((state: State) => state.app.selectedGroup);

  useEffect(() => {
    if (svgRef.current != null) {
      const svg = svgRef.current as SVGSVGElement;
      if (svg != null && selectedGroup != null && selectedGroup != "") {
        const toBeClicked = svg
          .querySelector(`#${selectedGroup}`)
          ?.querySelector("path");
        if (toBeClicked != null) clickInteractiveElement(toBeClicked);
      } else {
        resetView();
      }
    }
  }, [selectedGroup]);

  return (
    <div className="size-full grid grid-cols-1 grid-rows-1 relative opacity-80">
      <div className="absolute size-full">
        <div
          className="size-full flex justify-center resize-none relative cursor-pointer"
          onClick={(e) => {
            resetView();
            if (svgRef.current != null) {
              setHiddenImages(svgRef.current as SVGSVGElement, true);
            }
            blinkStrokes();
          }}
          ref={svgRef}
        >
          <SVG
            onLoad={(src, isCached) => {
              setLoaded(true);
            }}
            src={svgFile}
            className="painting-svg size-full object-contain absolute"
            preProcessor={(code) => {
              const svgSize = getSvgDimensionsFromString(code);
              code = code.replace(
                "</svg>",
                `<rect id="viewbox-rect" x="0" y="0" width="${svgSize.width as number
                }" height="${svgSize.height as number
                }" fill="transparent" pointer-events="none"/></svg>`
              );
              return code;
            }}
          />
          {/* <MySVG
        className={`painting size-full object-contain absolute ${
          paintingContext?.mode === "default"
            ? "cursor-pointer"
            : "cursor-default"
        }`}
        onClick={() => {
          if (
            paintingContext?.mode === "default" ||
            paintingContext?.mode === "detail"
          ) {
            paintingContext?.updateMode("exploration");
            paintingContext?.updateText(
              "You are using the explorative mode of the 2D Prisoner Painting Explorer. You can touch the pulsating elements of the painting and retrieve related information. Particular figures and objects refer to aspects of everyday life in Bergen-Belsen that shaped the situation and fate of the prisoners. Please note that not all elements are interactive.",
              "Exploration Mode"
            );
          }
          blinkStrokes();
        }}
      />
      {pointerLine}
      {paintingContext?.mode === "default" && (
        <CursorArrowRaysIcon
          width={55}
          height={55}
          className="absolute top-1/4 left-1/2 pointer-events-none"
        />
      )} */}
        </div>
      </div>
    </div>
  );
}
