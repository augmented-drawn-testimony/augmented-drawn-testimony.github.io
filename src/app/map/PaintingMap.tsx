"use client";

import Map, { Layer, Source, type LayerProps, type MapRef } from "@vis.gl/react-maplibre";
import type { Feature, FeatureCollection, LineString, MultiPolygon, Point, Polygon, Position } from "geojson";
import type { StyleSpecification } from "maplibre-gl";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

type LngLatPosition = [number, number];
type TravelBounds = [LngLatPosition, LngLatPosition];
type TravelBoundsFitter = Pick<MapRef, "fitBounds">;
type World1938Properties = {
    NAME?: string;
    [key: string]: unknown;
};
type CountryLabelProperties = World1938Properties & {
    labelArea: number;
    labelTier: "large" | "medium" | "small" | "tiny" | "micro";
};
type HistoricalMapFeatureCollection = FeatureCollection<Polygon | MultiPolygon, World1938Properties>;
type CountryLabelFeatureCollection = FeatureCollection<Point, CountryLabelProperties>;

interface PaintingMapProps {
    ariaLabel: string;
    className?: string;
    start: { lat: number, lon: number }
    end?: { lat: number, lon: number }
    lineString?: LineString;
    mapyear?: number;
}

const travelAnimationDurationMs = 4500;
const travelReplayPauseMs = 1300;
const singlePointBoundsPaddingDegrees = 2;
const minimumLabelArea = 0.2;
const availableHistoricalMapYears = [1938, 1945, 1960];

const emptyCountryLabels: CountryLabelFeatureCollection = {
    type: "FeatureCollection",
    features: [],
};
const svgFallbackPaddingPercent = 0.16;
const mercatorLatitudeLimit = 85.051129;

const transparentMapStyle: StyleSpecification = {
    version: 8,
    name: "Transparent historical borders",
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
        {
            id: "map-background",
            type: "background",
            paint: {
                "background-color": "#f2f2f2",
                "background-opacity": 1.0
            },
        },
    ],
};

const world1938BorderLayer: LayerProps = {
    id: "world-1938-borders",
    type: "line",
    paint: {
        "line-color": "#000000",
        "line-width": 1,
    },
};

const world1938FillLayer: LayerProps = {
    id: "world-1938-fill",
    type: "fill",
    paint: {
        "fill-color": "#ffffff",
        "fill-opacity": 1.0
    },
};

function createWorld1938LabelLayer(
    id: string,
    labelTier: CountryLabelProperties["labelTier"],
    minzoom: number
): LayerProps {
    return {
        id,
        type: "symbol",
        minzoom,
        filter: ["==", ["get", "labelTier"], labelTier],
        layout: {
            "text-field": ["get", "NAME"],
            "text-font": ["Noto Sans Regular"],
            "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1,
                8,
                4,
                13,
            ],
            // "text-transform": "uppercase",
            "text-letter-spacing": 0.08,
            "text-max-width": 8,
            "text-allow-overlap": false,
            "text-ignore-placement": false,
        },
        paint: {
            "text-color": "#3d3d3d",
            "text-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1,
                0.45,
                3,
                0.85,
            ],
            "text-halo-color": "#ffffff",
            "text-halo-width": 1,
            "text-halo-blur": 0.5,
        },
    };
}

class MapErrorBoundary extends Component<
    { children: ReactNode; onMapUnavailable: () => void },
    { hasError: boolean }
> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch() {
        this.props.onMapUnavailable();
    }

    render() {
        if (this.state.hasError) {
            return null;
        }

        return this.props.children;
    }
}

const world1938LabelLayers = [
    createWorld1938LabelLayer("world-1938-labels-large", "large", 0),
    createWorld1938LabelLayer("world-1938-labels-medium", "medium", 0),
    createWorld1938LabelLayer("world-1938-labels-small", "small", 0),
    createWorld1938LabelLayer("world-1938-labels-tiny", "tiny", 0),
    createWorld1938LabelLayer("world-1938-labels-micro", "micro", 5),
];

const fullTravelRouteLayer: LayerProps = {
    id: "full-travel-route",
    type: "line",
    paint: {
        "line-color": "#000000",
        "line-opacity": 0.18,
        "line-width": 2,
        "line-dasharray": [2, 2],
    },
};

const animatedTravelRouteLayer: LayerProps = {
    id: "animated-travel-route",
    type: "line",
    paint: {
        "line-color": "#000000",
        "line-width": 3,
        "line-opacity": 0.9,
    },
};

const travelPointLayer: LayerProps = {
    id: "travel-point",
    type: "circle",
    paint: {
        "circle-color": "rgb(230, 202, 173)",
        "circle-radius": 5,
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 1.5,
    },
};

function toPosition(coordinate: { lat: number, lon: number }): LngLatPosition {
    return [coordinate.lon, coordinate.lat];
}

function interpolatePosition(start: LngLatPosition, end: LngLatPosition, progress: number): LngLatPosition {
    return [
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress,
    ];
}

function isValidLngLatPosition(position: Position): position is LngLatPosition {
    return isLngLatPosition(position)
        && Number.isFinite(position[0])
        && Number.isFinite(position[1])
        && position[0] >= -180
        && position[0] <= 180
        && position[1] >= -90
        && position[1] <= 90;
}

function createTravelCoordinates(
    start: LngLatPosition,
    end: LngLatPosition | undefined,
    lineString: LineString | undefined
): LngLatPosition[] {
    const lineStringCoordinates = lineString?.type === "LineString"
        ? lineString.coordinates.filter(isValidLngLatPosition)
        : [];

    if (lineStringCoordinates.length >= 2) {
        return lineStringCoordinates;
    }

    return end == null ? [start, start] : [start, end];
}

function getSegmentLength(start: LngLatPosition, end: LngLatPosition) {
    const meanLatitudeRadians = (start[1] + end[1]) * Math.PI / 360;
    const longitudeDistance = (end[0] - start[0]) * Math.cos(meanLatitudeRadians);
    const latitudeDistance = end[1] - start[1];
    return Math.hypot(longitudeDistance, latitudeDistance);
}

function getPositionAlongRoute(coordinates: LngLatPosition[], progress: number) {
    const segmentLengths = coordinates.slice(1).map((coordinate, index) => (
        getSegmentLength(coordinates[index], coordinate)
    ));
    const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);

    if (totalLength === 0) {
        const position = coordinates[coordinates.length - 1];
        return { position, coordinates: [coordinates[0], position] };
    }

    const targetLength = Math.max(0, Math.min(progress, 1)) * totalLength;
    let travelledLength = 0;

    for (let index = 0; index < segmentLengths.length; index += 1) {
        const segmentLength = segmentLengths[index];

        if (travelledLength + segmentLength >= targetLength) {
            const segmentProgress = segmentLength === 0
                ? 1
                : (targetLength - travelledLength) / segmentLength;
            const position = interpolatePosition(coordinates[index], coordinates[index + 1], segmentProgress);

            return {
                position,
                coordinates: [...coordinates.slice(0, index + 1), position],
            };
        }

        travelledLength += segmentLength;
    }

    return {
        position: coordinates[coordinates.length - 1],
        coordinates,
    };
}

function easeInOut(progress: number) {
    return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function createLineFeature(coordinates: LngLatPosition[]): Feature<LineString> {
    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "LineString",
            coordinates,
        },
    };
}

function createPointFeature(coordinate: LngLatPosition): Feature<Point> {
    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "Point",
            coordinates: coordinate,
        },
    };
}

function isLngLatPosition(position: Position): position is LngLatPosition {
    return typeof position[0] === "number" && typeof position[1] === "number";
}

function getOuterRing(polygon: Position[][]) {
    return polygon[0]?.filter(isLngLatPosition) ?? [];
}

function getSignedRingArea(ring: LngLatPosition[]) {
    if (ring.length < 3) {
        return 0;
    }

    let area = 0;

    for (let i = 0; i < ring.length; i += 1) {
        const current = ring[i];
        const next = ring[(i + 1) % ring.length];
        area += current[0] * next[1] - next[0] * current[1];
    }

    return area / 2;
}

function getRingCentroid(ring: LngLatPosition[]): LngLatPosition {
    const signedArea = getSignedRingArea(ring);

    if (signedArea === 0) {
        const total = ring.reduce<LngLatPosition>(
            (sum, coordinate) => [sum[0] + coordinate[0], sum[1] + coordinate[1]],
            [0, 0]
        );

        return [total[0] / ring.length, total[1] / ring.length];
    }

    let longitude = 0;
    let latitude = 0;

    for (let i = 0; i < ring.length; i += 1) {
        const current = ring[i];
        const next = ring[(i + 1) % ring.length];
        const factor = current[0] * next[1] - next[0] * current[1];
        longitude += (current[0] + next[0]) * factor;
        latitude += (current[1] + next[1]) * factor;
    }

    const scale = 1 / (6 * signedArea);
    return [longitude * scale, latitude * scale];
}

function getLabelTier(labelArea: number): CountryLabelProperties["labelTier"] | undefined {
    if (labelArea >= 100) {
        return "large";
    }

    if (labelArea >= 20) {
        return "medium";
    }

    if (labelArea >= 5) {
        return "small";
    }

    if (labelArea >= 1) {
        return "tiny";
    }

    if (labelArea >= minimumLabelArea) {
        return "micro";
    }

    return undefined;
}

function createCountryLabelFeatures(data: HistoricalMapFeatureCollection): CountryLabelFeatureCollection {
    const features: CountryLabelFeatureCollection["features"] = [];

    data.features.forEach((feature) => {
        const name = feature.properties?.NAME;

        if (name == null) {
            return;
        }

        const polygons = feature.geometry.type === "Polygon"
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates;

        polygons.forEach((polygon) => {
            const ring = getOuterRing(polygon);
            const labelArea = Math.abs(getSignedRingArea(ring));
            const labelTier = getLabelTier(labelArea);

            if (ring.length < 3 || labelTier == null) {
                return;
            }

            features.push({
                type: "Feature",
                properties: {
                    ...feature.properties,
                    labelArea,
                    labelTier,
                },
                geometry: {
                    type: "Point",
                    coordinates: getRingCentroid(ring),
                },
            });
        });
    });

    return {
        type: "FeatureCollection",
        features,
    };
}

function getHistoricalMapYear(mapyear?: number) {
    if (mapyear == null) {
        return availableHistoricalMapYears[0];
    }

    const matchingYear = availableHistoricalMapYears
        .filter((availableYear) => availableYear <= mapyear)
        .at(-1);

    return matchingYear ?? availableHistoricalMapYears[0];
}

function getHistoricalMapUrl(mapyear?: number) {
    return `/maps/world_${getHistoricalMapYear(mapyear)}.geojson`;
}

function createTravelBounds(coordinates: LngLatPosition[]): TravelBounds {
    const [start] = coordinates;

    if (coordinates.every((coordinate) => coordinate[0] === start[0] && coordinate[1] === start[1])) {
        return [
            [
                start[0] - singlePointBoundsPaddingDegrees,
                start[1] - singlePointBoundsPaddingDegrees,
            ],
            [
                start[0] + singlePointBoundsPaddingDegrees,
                start[1] + singlePointBoundsPaddingDegrees,
            ],
        ];
    }

    return coordinates.reduce<TravelBounds>(
        (bounds, coordinate) => [
            [Math.min(bounds[0][0], coordinate[0]), Math.min(bounds[0][1], coordinate[1])],
            [Math.max(bounds[1][0], coordinate[0]), Math.max(bounds[1][1], coordinate[1])],
        ],
        [[start[0], start[1]], [start[0], start[1]]]
    );
}

function fitMapToTravelBounds(map: TravelBoundsFitter, bounds: TravelBounds) {
    map.fitBounds(bounds, {
        padding: 48,
        duration: 900,
        maxZoom: 5,
    });
}

function canCreateWebGlContext() {
    if (typeof document === "undefined") {
        return true;
    }

    const canvas = document.createElement("canvas");
    const contextAttributes: WebGLContextAttributes = {
        antialias: false,
        failIfMajorPerformanceCaveat: false,
        powerPreference: "high-performance",
    };

    try {
        return Boolean(
            canvas.getContext("webgl2", contextAttributes)
            || canvas.getContext("webgl", contextAttributes)
            || canvas.getContext("experimental-webgl", contextAttributes)
        );
    } catch {
        return false;
    }
}

function shouldUseFallbackForMapError(error: unknown) {
    if (error == null) {
        return false;
    }

    const message = error instanceof Error
        ? error.message
        : String(error);

    return /webgl|context|swiftshader|angle/i.test(message);
}

function clampLatitude(latitude: number) {
    return Math.max(-mercatorLatitudeLimit, Math.min(mercatorLatitudeLimit, latitude));
}

function projectMercator([longitude, latitude]: LngLatPosition): LngLatPosition {
    const latitudeRadians = clampLatitude(latitude) * Math.PI / 180;
    const mercatorY = Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)) * 180 / Math.PI;

    return [longitude, -mercatorY];
}

function createSvgViewBox(bounds: TravelBounds) {
    const [southWest, northEast] = bounds;
    const northWest = projectMercator([southWest[0], northEast[1]]);
    const southEast = projectMercator([northEast[0], southWest[1]]);
    const width = Math.max(southEast[0] - northWest[0], 1);
    const height = Math.max(southEast[1] - northWest[1], 1);
    const padding = Math.max(width, height) * svgFallbackPaddingPercent;

    return {
        minX: northWest[0] - padding,
        minY: northWest[1] - padding,
        width: width + padding * 2,
        height: height + padding * 2,
    };
}

function projectedPositionToSvgCommand(position: Position, index: number) {
    if (!isLngLatPosition(position)) {
        return "";
    }

    const [x, y] = projectMercator(position);
    const command = index === 0 ? "M" : "L";
    return `${command}${x.toFixed(4)} ${y.toFixed(4)}`;
}

function createSvgRingPath(ring: Position[]) {
    const path = ring
        .map(projectedPositionToSvgCommand)
        .filter(Boolean)
        .join(" ");

    return path.length > 0 ? `${path} Z` : "";
}

function createSvgPolygonPath(polygon: Position[][]) {
    return polygon
        .map(createSvgRingPath)
        .filter(Boolean)
        .join(" ");
}

function createSvgFeaturePath(feature: Feature<Polygon | MultiPolygon, World1938Properties>) {
    if (feature.geometry.type === "Polygon") {
        return createSvgPolygonPath(feature.geometry.coordinates);
    }

    return feature.geometry.coordinates
        .map(createSvgPolygonPath)
        .filter(Boolean)
        .join(" ");
}

function createSvgLinePoints(coordinates: Position[]) {
    return coordinates
        .filter(isLngLatPosition)
        .map((coordinate) => projectMercator(coordinate).map((value) => value.toFixed(4)).join(","))
        .join(" ");
}

function isPointInSvgViewBox(coordinate: LngLatPosition, viewBox: ReturnType<typeof createSvgViewBox>) {
    const [x, y] = projectMercator(coordinate);

    return (
        x >= viewBox.minX
        && x <= viewBox.minX + viewBox.width
        && y >= viewBox.minY
        && y <= viewBox.minY + viewBox.height
    );
}

function getSvgLabelFontSize(labelTier: CountryLabelProperties["labelTier"]) {
    switch (labelTier) {
        case "large":
            return 3.6;
        case "medium":
            return 2.6;
        case "small":
            return 1.9;
        case "tiny":
            return 1.35;
        case "micro":
            return 1;
    }
}

function PaintingMapSvgFallback({
    ariaLabel,
    mapData,
    countryLabels,
    routeFeature,
    animatedRouteFeature,
    travelPointFeature,
    travelBounds,
}: {
    ariaLabel: string;
    mapData: HistoricalMapFeatureCollection | null;
    countryLabels: CountryLabelFeatureCollection;
    routeFeature: Feature<LineString>;
    animatedRouteFeature: Feature<LineString>;
    travelPointFeature: Feature<Point>;
    travelBounds: TravelBounds;
}) {
    const viewBox = useMemo(() => createSvgViewBox(travelBounds), [travelBounds]);
    const countryPaths = useMemo(() => {
        return mapData?.features
            .map((feature, index) => ({
                id: `${feature.properties?.NAME ?? "country"}-${index}`,
                path: createSvgFeaturePath(feature),
            }))
            .filter((feature) => feature.path.length > 0) ?? [];
    }, [mapData]);
    const routePoints = useMemo(() => createSvgLinePoints(routeFeature.geometry.coordinates), [routeFeature]);
    const animatedRoutePoints = useMemo(() => createSvgLinePoints(animatedRouteFeature.geometry.coordinates), [animatedRouteFeature]);
    const [travelPointX, travelPointY] = useMemo(
        () => isLngLatPosition(travelPointFeature.geometry.coordinates)
            ? projectMercator(travelPointFeature.geometry.coordinates)
            : [0, 0],
        [travelPointFeature]
    );
    const visibleLabels = useMemo(() => {
        return countryLabels.features.filter((feature) => {
            return feature.properties.labelTier !== "micro"
                && isLngLatPosition(feature.geometry.coordinates)
                && isPointInSvgViewBox(feature.geometry.coordinates, viewBox);
        });
    }, [countryLabels, viewBox]);

    return (
        <svg
            className="painting-map-fallback"
            viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={ariaLabel}
        >
            <rect
                x={viewBox.minX}
                y={viewBox.minY}
                width={viewBox.width}
                height={viewBox.height}
                className="painting-map-fallback-background"
            />
            <g className="painting-map-fallback-countries">
                {countryPaths.map((feature) => (
                    <path key={feature.id} d={feature.path} />
                ))}
            </g>
            <polyline className="painting-map-fallback-route" points={routePoints} />
            <polyline className="painting-map-fallback-route-active" points={animatedRoutePoints} />
            <circle className="painting-map-fallback-point" cx={travelPointX} cy={travelPointY} r="0.55" />
            <g className="painting-map-fallback-labels">
                {visibleLabels.map((feature, index) => {
                    if (!isLngLatPosition(feature.geometry.coordinates)) {
                        return null;
                    }

                    const [x, y] = projectMercator(feature.geometry.coordinates);

                    return (
                        <text
                            key={`${feature.properties.NAME ?? "label"}-${index}`}
                            x={x}
                            y={y}
                            fontSize={getSvgLabelFontSize(feature.properties.labelTier)}
                        >
                            {feature.properties.NAME}
                        </text>
                    );
                })}
            </g>
        </svg>
    );
}

export function PaintingMap(props: PaintingMapProps) {
    const mapRef = useRef<MapRef | null>(null);
    const [animationProgress, setAnimationProgress] = useState(props.end || props.lineString ? 0 : 1);
    const [useSvgFallback, setUseSvgFallback] = useState(false);
    const [historicalMapData, setHistoricalMapData] = useState<HistoricalMapFeatureCollection | null>(null);
    const [countryLabels, setCountryLabels] = useState<CountryLabelFeatureCollection>(emptyCountryLabels);

    const startPosition = useMemo(() => toPosition(props.start), [props.start.lat, props.start.lon]);
    const endPosition = useMemo(() => props.end ? toPosition(props.end) : undefined, [props.end?.lat, props.end?.lon]);
    const travelCoordinates = useMemo(
        () => createTravelCoordinates(startPosition, endPosition, props.lineString),
        [endPosition, props.lineString, startPosition]
    );
    const travelBounds = useMemo(() => createTravelBounds(travelCoordinates), [travelCoordinates]);
    const historicalMapUrl = useMemo(() => getHistoricalMapUrl(props.mapyear), [props.mapyear]);

    const routeFeature = useMemo(() => {
        return createLineFeature(travelCoordinates);
    }, [travelCoordinates]);

    const currentRoute = useMemo(
        () => getPositionAlongRoute(travelCoordinates, animationProgress),
        [animationProgress, travelCoordinates]
    );

    const animatedRouteFeature = useMemo(() => {
        return createLineFeature(currentRoute.coordinates);
    }, [currentRoute.coordinates]);

    const travelPointFeature = useMemo(() => {
        return createPointFeature(currentRoute.position);
    }, [currentRoute.position]);

    useEffect(() => {
        setUseSvgFallback(!canCreateWebGlContext());
    }, []);

    useEffect(() => {
        let isMounted = true;

        setHistoricalMapData(null);
        setCountryLabels(emptyCountryLabels);

        fetch(historicalMapUrl)
            .then((response) => response.json())
            .then((data: HistoricalMapFeatureCollection) => {
                if (isMounted) {
                    setHistoricalMapData(data);
                    setCountryLabels(createCountryLabelFeatures(data));
                }
            })
            .catch(() => {
                if (isMounted) {
                    setHistoricalMapData(null);
                    setCountryLabels(emptyCountryLabels);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [historicalMapUrl]);

    useEffect(() => {
        if (props.end == null && props.lineString == null) {
            setAnimationProgress(1);
            return;
        }

        setAnimationProgress(0);

        let animationFrame = 0;
        let startedAt: number | undefined;

        function animate(timestamp: number) {
            startedAt ??= timestamp;

            const elapsed = timestamp - startedAt;
            const replayDuration = travelAnimationDurationMs + travelReplayPauseMs;
            const replayElapsed = elapsed % replayDuration;
            const linearProgress = Math.min(replayElapsed / travelAnimationDurationMs, 1);
            setAnimationProgress(easeInOut(linearProgress));

            animationFrame = window.requestAnimationFrame(animate);
        }

        animationFrame = window.requestAnimationFrame(animate);

        return () => {
            window.cancelAnimationFrame(animationFrame);
        };
    }, [props.end, props.lineString]);

    useEffect(() => {
        const map = mapRef.current;

        if (map == null) {
            return;
        }

        fitMapToTravelBounds(map, travelBounds);
    }, [travelBounds]);

    return (
        <div className={`painting-map size-full bg-transparent z-1 ${props.className ?? ""}`}>
            {useSvgFallback ? (
                <PaintingMapSvgFallback
                    ariaLabel={props.ariaLabel}
                    mapData={historicalMapData}
                    countryLabels={countryLabels}
                    routeFeature={routeFeature}
                    animatedRouteFeature={animatedRouteFeature}
                    travelPointFeature={travelPointFeature}
                    travelBounds={travelBounds}
                />
            ) : (
                <MapErrorBoundary onMapUnavailable={() => setUseSvgFallback(true)}>
                    <Map
                        ref={mapRef}
                        style={{ width: "100%", height: "100%" }}
                        initialViewState={{
                            longitude: 10,
                            latitude: 30,
                            zoom: 1.15,
                        }}
                        mapStyle={transparentMapStyle}
                        minZoom={0.75}
                        maxZoom={8}
                        projection="mercator"
                        attributionControl={false}
                        dragPan={false}
                        scrollZoom={false}
                        boxZoom={false}
                        doubleClickZoom={false}
                        touchZoomRotate={false}
                        dragRotate={false}
                        keyboard={false}
                        onLoad={(event) => {
                            fitMapToTravelBounds(event.target, travelBounds);
                        }}
                        onError={(event) => {
                            if (shouldUseFallbackForMapError(event.error)) {
                                setUseSvgFallback(true);
                            }
                        }}
                    >
                        <Source id="world1938" type="geojson" data={historicalMapUrl}>
                            <Layer {...world1938FillLayer} />
                            <Layer {...world1938BorderLayer} />
                        </Source>
                        <Source id="world1938Labels" type="geojson" data={countryLabels}>
                            {world1938LabelLayers.map((layer) => (
                                <Layer key={layer.id} {...layer} />
                            ))}
                        </Source>
                        <Source id="fullTravelRoute" type="geojson" data={routeFeature}>
                            <Layer {...fullTravelRouteLayer} />
                        </Source>
                        <Source id="animatedTravelRoute" type="geojson" data={animatedRouteFeature}>
                            <Layer {...animatedTravelRouteLayer} />
                        </Source>
                        <Source id="travelPoint" type="geojson" data={travelPointFeature}>
                            <Layer {...travelPointLayer} />
                        </Source>
                    </Map>
                </MapErrorBoundary>
            )}
        </div>
    );
}
