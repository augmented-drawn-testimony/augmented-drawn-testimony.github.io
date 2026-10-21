import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { State } from "../../../store/store";
import { messages } from "../../i18n/messages";

interface PaintingAudioProps {
    src: string;
}

export function getSteenPortrait() {
    return <div className="h-20 w-20 pt-1 shrink-0 overflow-hidden rounded-full border-2 border-gray-300 bg-gray-100">
        <img
            src='/images/steen_icon.png'
            alt=""
            className="h-full w-full object-cover"
        />
    </div>
}

export function PaintingAudio(props: PaintingAudioProps) {
    const { src } = props;
    const language = useSelector((state: State) => state.app.language);
    const ui = messages[language].audio;

    const audioRef = useRef<HTMLAudioElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);

    const togglePlay = async () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            await audio.play();
        }
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        setCurrentTime(audioRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
        if (!audioRef.current) return;
        setDuration(audioRef.current.duration);
    };

    const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
        const newTime = Number(e.target.value);
        if (!audioRef.current) return;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newVolume = Number(e.target.value);
        if (!audioRef.current) return;
        audioRef.current.volume = newVolume;
        setVolume(newVolume);
    };

    const formatTime = (time: number) => {
        if (!time || Number.isNaN(time)) return "0:00";

        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60)
            .toString()
            .padStart(2, "0");

        return `${minutes}:${seconds}`;
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => setIsPlaying(false);

        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onEnded);

        return () => {
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("ended", onEnded);
        };
    }, []);

    const progress = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div className="w-11/12">
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
            />

            <div className="flex items-center gap-3">
                {/* Avatar */}
                {getSteenPortrait()}

                {/* Main controls */}
                <div className="flex flex-1 flex-col gap-2 opacity-50">
                    <div className="text-xs">{ui.listen}</div>
                    {/* Progress bar */}
                    <div className="relative h-2 w-full bg-slate-300 rounded-md">
                        <div
                            className="absolute left-0 top-0 h-full bg-[var(--highlight-dark)] rounded-md"
                            style={{ width: `${progress}%` }}
                        />

                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            aria-label={ui.seek}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            {/* Play / Pause */}
                            <button
                                type="button"
                                onClick={togglePlay}
                                className="flex h-4 w-4 items-center justify-center transition text-[var(--highlight-dark)] hover:text-slate-500 cursor-pointer"
                                aria-label={isPlaying ? ui.pause : ui.play}
                            >
                                {isPlaying ? (
                                    <span className="flex gap-1">
                                        <span className="h-4 w-1.5 bg-current" />
                                        <span className="h-4 w-1.5 bg-current" />
                                    </span>
                                ) : (
                                    <span className="ml-1 h-0 w-0 border-y-[9px] border-l-[18px] border-y-transparent border-l-current" />
                                )}
                            </button>

                            {/* Speaker + volume */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="w-20 accent-[var(--highlight-dark)] h-2"
                                    aria-label={ui.volume}
                                />
                                <SpeakerIcon />
                            </div>
                        </div>

                        {/* Time */}
                        <div className="text-xs tabular-nums">
                            {formatTime(currentTime)}/{formatTime(duration)}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}

interface SpeackerProps {
    onClick?: () => void
}

function SpeakerIcon(props: SpeackerProps) {
    const { onClick } = props;
    return (
        <svg
            viewBox="0 0 64 64"
            className="h-6 w-6 fill-current"
            aria-hidden="true"
            onClick={onClick}
        >
            <path d="M8 24h12l18-15v46L20 40H8z" />
            <path
                d="M44 22c4 4 6 7 6 10s-2 6-6 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
            />
            <path
                d="M50 14c7 6 10 12 10 18s-3 12-10 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
            />
        </svg>
    );
}
