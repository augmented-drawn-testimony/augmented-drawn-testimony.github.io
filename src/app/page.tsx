"use client";
import { Noto_Serif, Reenie_Beanie } from "next/font/google";
import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { Language, setLanguage, setMode, setSelectedGroup, setSelectedPainting } from "../../store/appSlice";
import { State, store } from "../../store/store";
import { Navbar } from "../components/ui/Navbar";
import { messages } from "../i18n/messages";
import Painting from "./2d-painting/painting";
import { PaintingTimeline } from "./2d-painting/PaintingTimeline";
import { getSteenPortrait, PaintingAudio } from "./2d-painting/PaintingAudio";
import { PaintingMap } from "./map/PaintingMap";
import { ARPainting } from "./ar/ARPainting";
import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import { TutorialOverlay } from "./TutorialOverlay";
import type { LineString } from "geojson";
import paintingDefinitions from "../data/paintings.json";

const reenie_beanie = Reenie_Beanie({ weight: "400", subsets: ["latin"] });
const noto_serif = Noto_Serif({ weight: "400", subsets: ["latin"] });

const storyDataUrls: Record<Language, string> = {
  en: "/story-data.json",
  da: "/story-data.da.json",
};

// const Model = dynamic(() => import("@/components/model-viewer/Model"), {
//   loading: () => <p>Loading...</p>,
//   ssr: false,
// });

interface PaintingDefinition {
  key: string;
  svgFile: string;
  inactive?: boolean;
  noTimelineThumbnails?: boolean;
}

const paintings: PaintingDefinition[] = paintingDefinitions;

function AnimatedWords({
  text,
  delay = 0,
  className = "",
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  const words = text.trim().split(/\s+/);

  return (
    <span className={`${className}`} aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true">
          <span
          // className="word-reveal-item"
          // style={{
          //   "--word-delay": `${delay + Math.min(index * 24, 600)}ms`,
          // } as CSSProperties}
          >
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

function renderStoryParagraph(text: string, paragraphIndex: number) {
  const quotePattern = /quote\((.*?)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = quotePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const prose = text.slice(lastIndex, match.index);
      parts.push(
        <AnimatedWords
          key={`story-prose-${paragraphIndex}-${lastIndex}`}
          text={prose}
          delay={paragraphIndex * 70}
        />
      );
    }

    parts.push(
      <div
        key={`story-quote-${paragraphIndex}-${match.index}`}
        className="w-full flex flex-row gap-3 items-center"
      >
        {getSteenPortrait()}
        <span className="italic">
          <AnimatedWords text={`"${match[1]}"`} delay={120} />
        </span>
      </div>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <AnimatedWords
        key={`story-prose-${paragraphIndex}-${lastIndex}`}
        text={text.slice(lastIndex)}
        delay={paragraphIndex * 70}
      />
    );
  }

  return parts.length > 0 ? parts : <AnimatedWords text={text} />;
}

function renderStoryText(text: string) {
  return text.split("\n").map((paragraph, i) => (
    <div key={`story-text-${i}`} className="story-paragraph">
      {renderStoryParagraph(paragraph, i)}
    </div>
  ));
}

export interface MapEntry {
  title: string;
  mapyear?: number;
  start: { lat: number, lon: number };
  end?: { lat: number, lon: number };
  lineString?: LineString;
}

export interface StoryDataItem {
  image?: string;
  caption?: string;
  copyright?: string | null;
}

export interface StoryEntry {
  title: string;
  subtitle: string;
  text: string;
  location: string;
  time: string;
  svgElement: string;
  audio?: string;
  map?: MapEntry;
  data?: StoryDataItem[];
  shorttitle?: string;
}

function StartScreen({
  language,
  onLanguageChange,
  onBegin,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onBegin: () => void;
}) {
  const ui = messages[language].startScreen;

  return (
    <div className="start-screen bg-white" aria-labelledby="start-screen-title">
      <div className="start-screen-language-wrapper">

        <div className="start-screen-language" aria-label={ui.language} role="group">
          {(["en", "da"] as const).map((locale) => (
            <button
              key={locale}
              type="button"
              aria-pressed={language === locale}
              onClick={() => onLanguageChange(locale)}
            >
              {locale === "en" ? "English" : "Dansk"}
            </button>
          ))}
        </div>
      </div>

      <div className="start-screen-art cursor-pointer" aria-hidden="true" onClick={onBegin}>
        <img src="/images/Title Steen.svg" alt="" />
      </div>

      <div className="start-screen-content cursor-pointer" onClick={onBegin}>
        <p className="start-screen-eyebrow">{ui.eyebrow}</p>
        <h1 id="start-screen-title" className={noto_serif.className}>
          {ui.title.split("\n").map((line) => (
            <div key={line}>{line}</div>
          ))}
        </h1>
        <p className={`text-[var(--highlight-dark)] start-screen-subtitle ${reenie_beanie.className}`}>
          {ui.subtitle}
        </p>
        <p className="start-screen-invitation">{ui.invitation}</p>

        <p className="mt-8 text-2xl italic text-[var(--highlight-dark)]">{ui.begin}</p>
      </div>
    </div>
  );
}

function MainMenu() {
  const mode = useSelector((state: State) => state.app.mode);
  const dispatch = useDispatch();

  const selectedPainting = useSelector(
    (state: State) => state.app.selectedPainting
  );

  const selectedGroup = useSelector((state: State) => state.app.selectedGroup);
  const language = useSelector((state: State) => state.app.language);
  const ui = messages[language];

  const [storyDataByLanguage, setStoryDataByLanguage] = useState<
    Partial<Record<Language, Record<string, StoryEntry>>>
  >({});
  const [dataView, setDataView] = useState<boolean>(false);
  const [focusData, setFocusData] = useState<any>(null);
  const [discoveredStoryKeys, setDiscoveredStoryKeys] = useState<Array<string>>([]);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [startScreenOpen, setStartScreenOpen] = useState(true);
  const [arMode, setArMode] = useState(false);
  const [trackedSceneIndex, setTrackedSceneIndex] = useState<number | null>(null);
  const [arStoryOpen, setArStoryOpen] = useState(false);

  useEffect(() => {
    Promise.all(
      (Object.entries(storyDataUrls) as [Language, string][]).map(
        async ([locale, url]) => {
          const response = await fetch(url);
          const data = (await response.json()) as Record<string, StoryEntry>;
          return [locale, data] as const;
        }
      )
    ).then((entries) => {
      setStoryDataByLanguage(
        Object.fromEntries(entries) as Record<
          Language,
          Record<string, StoryEntry>
        >
      );
    });
  }, []);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("memorise-language");
    if (savedLanguage === "en" || savedLanguage === "da") {
      dispatch(setLanguage(savedLanguage));
    }
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("memorise-language", language);
    setFocusData(null);
  }, [language]);

  const storyData = storyDataByLanguage[language];

  const painting = useMemo(() => {
    return paintings.filter((e, i) => i === selectedPainting)[0];
  }, [selectedPainting]);

  const selectedStoryKey = useMemo(() => {
    if (storyData == null) {
      return null;
    }

    if (selectedGroup != null && Object.keys(storyData).includes(selectedGroup)) {
      return selectedGroup;
    }

    if (storyData[painting.key] != null) {
      return painting.key;
    }

    return null;
  }, [painting, selectedGroup, storyData]);

  useEffect(() => {
    if (selectedStoryKey == null) {
      return;
    }

    setDiscoveredStoryKeys((currentKeys) =>
      currentKeys.includes(selectedStoryKey)
        ? currentKeys
        : [...currentKeys, selectedStoryKey]
    );
  }, [selectedStoryKey]);

  const story = useMemo(() => {
    if (storyData != null && selectedStoryKey != null) {
      return storyData[selectedStoryKey];
    } else {
      return {
        title: ui.story.missingTitle,
        text: ui.story.missingText,
        subtitle: ui.story.missingSubtitle,
        location: ui.story.missingLocation,
        time: ui.story.missingTime,
      } as StoryEntry;
    }
  }, [selectedStoryKey, storyData, ui.story]);

  useEffect(() => {
    if (story.data == null) {
      setDataView(false);
    }
  }, [story]);

  const renderContent = useCallback((story: any, dataView: any, inactive = false, selectedGroup: string | null = null) => {
    return <>
      <div className={`text-xl story-heading ${noto_serif.className}`}>
        {story.title
          ? story.title
            .split("\n")
            .map((e: any, i: number) => (
              <div key={`title-${i}`}>
                <AnimatedWords text={e} delay={i * 80} />
              </div>
            ))
          : ui.story.missingTitle}
      </div>
      <div className={`text-2xl ${reenie_beanie.className}`}>
        {story.subtitle
          ? story.subtitle
            .split("\n")
            .map((e: any, i: number) => (
              <div key={`timeline-subtitle-${i}`}>
                <AnimatedWords text={e} delay={100 + i * 80} />
              </div>
            ))
          : ui.story.missingSubtitle}
      </div>
      <div className="text-sm opacity-75 flex flex-col gap-1">
        <p>{story.time}</p>
        <p>{story.location}</p>
      </div>
      {dataView && story.data != null ?
        <>
          {story.data.map((e: any, i: number) => <div key={`story-data-${i}`} className="border-black border-0">
            {e.image && <div className="flex items-center cursor-zoom-in mb-1">
              <img onClick={() => { setFocusData(e) }} className="w-full z-50" src={e.image} alt={e.caption ?? ""} />
            </div>}
            {e.caption && <div>{e.caption}</div>}
            {e.copyright && <div>&copy;{e.copyright}</div>}
          </div>)}
        </>
        : <>
          <div className="text-base flex gap-1 flex-col">
            {story.text
              ? renderStoryText(story.text)
              : ui.story.missingText}
          </div>
          <div className="text-base flex gap-1 flex-col">
            {story.audio &&
              <PaintingAudio src={`/audio/${story.audio}`} />
            }
          </div>
          {
            story.map && <div className="text-sm flex gap-1 flex-col z-0">
              <div className="h-[300px] w-full border-2 border-gray-300 rounded-md opacity-90">
                <PaintingMap
                  start={story.map.start}
                  end={story.map.end}
                  lineString={story.map.lineString}
                  mapyear={story.map.mapyear}
                  ariaLabel={ui.map.historicalTravelMap}
                />
              </div>
              <div className="opacity-75">
                {story.map.title && <span>{story.map.title}</span>}
              </div>
            </div>
          }
          {painting.inactive !== true && !selectedGroup &&
            <div className="mt-7 w-full flex justify-center">
              <div className="text-base flex flex-row items-center gap-1">
                <div><CursorArrowRaysIcon className="size-7 animate-pulse" /></div>
                <span className="italic text-gray-600">{ui.story.interactionPrompt}</span>
              </div>
            </div>}
        </>}
    </>
  }, [ui])

  const viewToggle = (
    <div className="flex justify-end mb-2" data-tutorial="data">
      <button
        type="button"
        className="interface-pill-button story-view-button"
        title={!dataView && story.data == null ? ui.navbar.dataUnavailable : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setDataView((currentView) => !currentView);
        }}
      >
        {dataView ? ui.story.seeStory : ui.story.seeEvidenceResources}
      </button>
    </div>
  );

  return (
    <div
      className={`grid grid-cols-1 overflow-hidden size-full painting-main ${arMode ? "ar-main grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[auto_minmax(0,1fr)_auto]"}`}
      onClick={() => {
        dispatch(setMode("explore"));
      }}
    >
      <Navbar
        language={language}
        tutorialOpen={tutorialOpen}
        arMode={arMode}
        onToggleAr={() => {
          setStartScreenOpen(false);
          setTrackedSceneIndex(null);
          setArStoryOpen(false);
          setArMode((current) => !current);
        }}
        onLanguageChange={(nextLanguage) => dispatch(setLanguage(nextLanguage))}
        onLogoClick={() => {
          setArMode(false);
          setTrackedSceneIndex(null);
          dispatch(setSelectedPainting(0));
          setStartScreenOpen(true);
        }}
        onOpenTutorial={() => setTutorialOpen(true)}
      />

      {arMode ? (
        <div className="ar-experience relative size-full min-h-0">
          <ARPainting
            scenes={paintings}
            language={language}
            selectedGroup={selectedGroup}
            onSceneFound={(index) => {
              setTrackedSceneIndex(index);
              if (selectedPainting !== index) {
                dispatch(setSelectedPainting(index));
                dispatch(setSelectedGroup(null));
                setArStoryOpen(false);
              }
            }}
            onSceneLost={(index) => setTrackedSceneIndex((current) => current === index ? null : current)}
            onSelectGroup={(index, group) => {
              if (selectedPainting !== index) dispatch(setSelectedPainting(index));
              dispatch(setSelectedGroup(group));
              if (group) setArStoryOpen(true);
            }}
          />

          {storyData != null && (
            <div className={`ar-story-drawer ${arStoryOpen ? "is-open" : ""}`} data-tutorial="story">
              {arStoryOpen ? (
                <>
                  <button type="button" className="ar-story-toggle" onClick={() => setArStoryOpen(false)} aria-label={ui.ar.closeStory}>
                    <span>{ui.ar.closeStory}</span>
                    <ChevronDownIcon className="size-5 shrink-0" />
                  </button>
                  <div className="ar-story-scroll">
                    <div key={`${language}-${selectedStoryKey}-${dataView ? "data" : "story"}`} className="flex gap-2 flex-col p-4 story-sequence">
                      {story.data != null && viewToggle}
                      {renderContent(story, dataView, painting.inactive, selectedGroup)}
                    </div>
                  </div>
                </>
              ) : (
                <button type="button" className="ar-story-toggle" onClick={() => setArStoryOpen(true)} aria-label={ui.ar.openStory}>
                  <span className={noto_serif.className}>{trackedSceneIndex === selectedPainting ? story.title : ui.ar.openStory}</span>
                  <ChevronUpIcon className="size-5 shrink-0" />
                </button>
              )}
            </div>
          )}

          <div className="painting-timeline-area ar-timeline" data-tutorial="timeline">
            {storyData && (
              <PaintingTimeline
                paintings={paintings}
                storyData={storyData}
                discoveredStoryKeys={discoveredStoryKeys}
                autoFollowSelection
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="painting-content relative grid size-full min-h-0 grid-rows-1 grid-cols-[70%_30%] items-center justify-center">
            <div className="painting-stage size-full relative" data-tutorial="painting">
              <Painting
                key={painting.key}
                svgFile={painting.svgFile}
                inactive={painting.inactive}
                discoveredStoryKeys={discoveredStoryKeys}
                missingSvgPath={ui.story.missingSvgPath}
              />
            </div>

            <div className="painting-story size-full relative" data-tutorial="story">
              <div className="size-full absolute top-0 left-0">
                {storyData != null && (
                  <div className={`size-full opacity-80 text-gray-950 relative transition-all ${dataView ? 'bg-gray-300 border-l border-gray-400' : ''}`}>
                    <div className="painting-story-scroll absolute top-0 left-0 size-full overflow-hidden overflow-y-scroll flex items-center">
                      <div
                        key={`${language}-${selectedStoryKey}-${dataView ? "data" : "story"}`}
                        className="w-full max-h-full flex gap-2 flex-col p-3 px-6 story-sequence"
                      >
                        {story.data != null && viewToggle}
                        {renderContent(story, dataView, painting.inactive, selectedGroup)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="painting-timeline-area size-full" data-tutorial="timeline">
            {storyData && (
              <PaintingTimeline
                paintings={paintings}
                storyData={storyData}
                discoveredStoryKeys={discoveredStoryKeys}
              />
            )}
          </div>
        </>
      )}

      {focusData != null && <div className="absolute top-0 left-0 size-full flex flex-col gap-2 items-center justify-center bg-gray-200/80 z-[900] cursor-zoom-out text-base" onClick={() => { setFocusData(null) }}>
        <div className="h-[80%] w-[80%] flex items-center justify-center">
          <img className="h-full w-full object-contain" src={focusData.image}></img>
        </div>
        {focusData.caption != null && <div>{focusData.caption}</div>}
        {focusData.copyright != null && <div>&copy; {focusData.copyright}</div>}
      </div>}

      <TutorialOverlay
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />
      {startScreenOpen && (
        <StartScreen
          language={language}
          onLanguageChange={(nextLanguage) => dispatch(setLanguage(nextLanguage))}
          onBegin={() => {
            dispatch(setMode("explore"));
            setStartScreenOpen(false);
          }}
        />
      )}
      <div className="painting-paper-overlay absolute inset-0 pointer-events-none z-[9999]" />
    </div>
  );
}

export default function Home() {
  useEffect(() => {
    const updateViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty(
        "--app-viewport-height",
        `${Math.round(height)}px`
      );
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
      document.documentElement.style.removeProperty("--app-viewport-height");
    };
  }, []);

  return (
    <Provider store={store}>
      <MainMenu />
    </Provider>
  );
}
