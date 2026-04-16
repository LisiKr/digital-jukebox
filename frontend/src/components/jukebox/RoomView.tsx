import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music,
  Menu,
  X,
  ListMusic,
  Trophy,
  Search,
  ThumbsUp,
  ThumbsDown,
  SkipForward,
  SkipBack,
  Play,
  Pause,
  Trash2,
  Save,
  DoorOpen,
  Plus,
  Minus,
  Repeat,
  Loader2,
  Users,
  Copy,
  Check,
  Crown,
  Lock,
  ShieldCheck,
  Settings2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getSocket } from "@/lib/socket";
import type {
  LeaderboardEntry,
  Member,
  RoomState,
  RoomSettings,
  SearchResult,
} from "./mockData";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

interface RoomViewProps {
  isHost: boolean;
  djName: string;
  roomCode: string;
  onLeave: () => void;
  onCloseRoom: () => void;
  initialState?: RoomState | null;
}

export function RoomView({
  isHost,
  djName,
  roomCode,
  onLeave,
  onCloseRoom,
  initialState,
}: RoomViewProps) {
  const [tab, setTab] = useState<"queue" | "leaderboard" | "room">("queue");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const defaultState: RoomState = {
    queue: [],
    pendingQueue: [],
    playedQueue: [],
    nowPlaying: null,
    vetoCount: 0,
    vetoNeeded: 0,
    members: [],
    leaderboard: [],
    settings: { maxSongsPerUser: 3, approvalMode: false, isLocked: false },
  };
  const [roomState, setRoomState] = useState<RoomState>(initialState || defaultState);
  const [replayTrigger, setReplayTrigger] = useState(0);

  const socket = getSocket();

  useEffect(() => {
    const handleUpdate = (data: RoomState) => {
      setRoomState(data);
    };

    const handleReplay = () => {
      setReplayTrigger((p) => p + 1);
    };

    socket.on("queue:updated", handleUpdate);
    socket.on("song:replay", handleReplay);

    socket.emit("room:requestSync");

    return () => {
      socket.off("queue:updated", handleUpdate);
      socket.off("song:replay", handleReplay);
    };
  }, [socket]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/search?q=${encodeURIComponent(search)}`,
        );
        const data = await res.json();
        setSearchResults(data.items || []);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleUpvote = useCallback(
    (itemId: string) => {
      if (upvoted.has(itemId)) return;
      socket.emit(
        "queue:upvote",
        { roomCode, itemId },
        (res: { ok: boolean }) => {
          if (res.ok) {
            setUpvoted((prev) => new Set(prev).add(itemId));
          }
        },
      );
    },
    [socket, roomCode, upvoted],
  );

  const handleVeto = useCallback(() => {
    socket.emit("queue:veto", { roomCode });
  }, [socket, roomCode]);

  const handleSkip = useCallback(() => {
    socket.emit("host:forceSkip", { roomCode });
  }, [socket, roomCode]);

  const handlePrevious = useCallback(() => {
    socket.emit("host:previous", { roomCode });
  }, [socket, roomCode]);

  const handleLoop = useCallback(() => {
    socket.emit("host:loop", { roomCode });
  }, [socket, roomCode]);

  const handleAddSong = useCallback(
    (result: SearchResult) => {
      socket.emit(
        "queue:add",
        {
          roomCode,
          videoId: result.videoId,
          title: result.title,
          thumbnail: result.thumbnail,
        },
        (res: { ok: boolean }) => {
          if (res.ok) {
            setSearch("");
            setSearchResults([]);
          }
        },
      );
    },
    [socket, roomCode],
  );

  const handleVideoEnded = useCallback(() => {
    socket.emit("host:ended", { roomCode });
  }, [socket, roomCode]);

  const handleUpdateSettings = useCallback(
    (patch: Partial<RoomSettings>) => {
      socket.emit("host:updateSettings", patch);
    },
    [socket],
  );

  const handleApproveSong = useCallback(
    (itemId: string) => {
      socket.emit("host:approveSong", { itemId });
    },
    [socket],
  );

  const handleRejectSong = useCallback(
    (itemId: string) => {
      socket.emit("host:rejectSong", { itemId });
    },
    [socket],
  );

  const myNorm = isHost ? "host" : djName.trim().toLowerCase();
  let myQueueCount = 0;
  if (roomState.nowPlaying?.addedByNorm === myNorm) myQueueCount++;
  myQueueCount += roomState.queue.filter((s) => s.addedByNorm === myNorm).length;
  myQueueCount += (roomState.pendingQueue || []).filter((s) => s.addedByNorm === myNorm).length;
  const atMaxSongs = !isHost && myQueueCount >= (roomState.settings?.maxSongsPerUser ?? 3);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-noise relative">
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-neon flex items-center justify-center">
            <Music className="h-4 w-4 text-neon-foreground" />
          </div>
          <span className="font-bold text-sm text-foreground">
            Digital Jukebox
          </span>
          {isHost && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/20 text-accent">
              Host
            </span>
          )}
          <span className="text-[10px] font-mono text-muted-foreground ml-1">
            {roomCode}
          </span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-surface active:scale-95 transition-all"
        >
          {menuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-4 z-40 w-56 rounded-xl bg-surface-elevated border border-border shadow-2xl overflow-hidden"
          >
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted-foreground">Logged in as</p>
              <p className="font-bold text-sm text-foreground">{djName}</p>
            </div>
            {isHost && (
              <>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface active:bg-border transition-colors text-foreground">
                  <Save className="h-4 w-4 text-primary" />
                  Save Playlist
                </button>
                <button
                  onClick={onCloseRoom}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface active:bg-border transition-colors text-destructive"
                >
                  <DoorOpen className="h-4 w-4" />
                  Close Room
                </button>
              </>
            )}
            <button
              onClick={onLeave}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface active:bg-border transition-colors text-muted-foreground"
            >
              <DoorOpen className="h-4 w-4" />
              Leave Room
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto pb-20 lg:mx-auto lg:w-full lg:max-w-5xl">
        <div className={tab === "queue" ? "block" : "hidden"}>
          <QueueTab
            roomState={roomState}
            isHost={isHost}
            search={search}
            setSearch={setSearch}
            searchResults={searchResults}
            searchLoading={searchLoading}
            upvoted={upvoted}
            handleUpvote={handleUpvote}
            handleVeto={handleVeto}
            handleSkip={handleSkip}
            handlePrevious={handlePrevious}
            handleLoop={handleLoop}
            handleAddSong={handleAddSong}
            handleVideoEnded={handleVideoEnded}
            replayTrigger={replayTrigger}
            atMaxSongs={atMaxSongs}
            handleApproveSong={handleApproveSong}
            handleRejectSong={handleRejectSong}
          />
        </div>
        <div className={tab === "leaderboard" ? "block" : "hidden"}>
          <LeaderboardTab leaderboard={roomState.leaderboard} />
        </div>
        <div className={tab === "room" ? "block" : "hidden"}>
          <RoomInfoTab
            roomCode={roomCode}
            members={roomState.members}
            isHost={isHost}
            settings={roomState.settings}
            onUpdateSettings={handleUpdateSettings}
          />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-background/90 backdrop-blur-xl border-t border-border flex">
        <button
          onClick={() => setTab("queue")}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            tab === "queue" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <ListMusic className="h-5 w-5" />
          <span className="text-[10px] font-medium">Queue & Search</span>
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            tab === "leaderboard" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Trophy className="h-5 w-5" />
          <span className="text-[10px] font-medium">Leaderboard</span>
        </button>
        <button
          onClick={() => setTab("room")}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
            tab === "room" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px] font-medium">Room</span>
          {roomState.members.length > 0 && (
            <span className="absolute top-2 right-1/4 h-4 min-w-4 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-1">
              {roomState.members.length}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}

function YouTubeEmbed({
  videoId,
  onEnded,
  replayTrigger,
  onPlayStateChange,
  playerApiRef,
}: {
  videoId: string;
  onEnded: () => void;
  replayTrigger: number;
  onPlayStateChange?: (playing: boolean) => void;
  playerApiRef?: React.MutableRefObject<{ play: () => void; pause: () => void } | null>;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onPlayStateRef = useRef(onPlayStateChange);
  onPlayStateRef.current = onPlayStateChange;

  useEffect(() => {
    let cancelled = false;

    const create = () => {
      if (cancelled || !wrapperRef.current) return;
      wrapperRef.current.innerHTML = "";
      const el = document.createElement("div");
      wrapperRef.current.appendChild(el);
      const w = window as any;
      playerRef.current = new w.YT.Player(el, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: any) => {
            if (e.data === w.YT.PlayerState.ENDED) {
              onEndedRef.current();
            }
            if (onPlayStateRef.current) {
              onPlayStateRef.current(e.data === w.YT.PlayerState.PLAYING);
            }
          },
        },
      });
      if (playerApiRef) {
        playerApiRef.current = {
          play: () => playerRef.current?.playVideo(),
          pause: () => playerRef.current?.pauseVideo(),
        };
      }
    };

    const w = window as any;
    if (w.YT?.Player) {
      create();
    } else {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        create();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }

    return () => {
      cancelled = true;
      if (playerApiRef) playerApiRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (replayTrigger > 0 && playerRef.current?.seekTo) {
      playerRef.current.seekTo(0);
      playerRef.current.playVideo();
    }
  }, [replayTrigger]);

  return <div ref={wrapperRef} className="w-full h-full" />;
}

function QueueTab({
  roomState,
  isHost,
  search,
  setSearch,
  searchResults,
  searchLoading,
  upvoted,
  handleUpvote,
  handleVeto,
  handleSkip,
  handlePrevious,
  handleLoop,
  handleAddSong,
  handleVideoEnded,
  replayTrigger,
  atMaxSongs,
  handleApproveSong,
  handleRejectSong,
}: {
  roomState: RoomState;
  isHost: boolean;
  search: string;
  setSearch: (s: string) => void;
  searchResults: SearchResult[];
  searchLoading: boolean;
  upvoted: Set<string>;
  handleUpvote: (id: string) => void;
  handleVeto: () => void;
  handleSkip: () => void;
  handlePrevious: () => void;
  handleLoop: () => void;
  handleAddSong: (result: SearchResult) => void;
  handleVideoEnded: () => void;
  replayTrigger: number;
  atMaxSongs: boolean;
  handleApproveSong: (id: string) => void;
  handleRejectSong: (id: string) => void;
}) {
  const { nowPlaying, queue, pendingQueue, playedQueue, vetoCount, vetoNeeded } = roomState;
  const vetoProgress = vetoNeeded > 0 ? vetoCount / vetoNeeded : 0;
  const [isPlaying, setIsPlaying] = useState(false);
  const playerApiRef = useRef<{ play: () => void; pause: () => void } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const currentSongRef = useRef<HTMLDivElement | null>(null);

  const handleSearchResultSelect = useCallback(
    (result: SearchResult) => {
      handleAddSong(result);
    },
    [handleAddSong],
  );

  const togglePlayPause = useCallback(() => {
    if (!playerApiRef.current) return;
    if (isPlaying) {
      playerApiRef.current.pause();
    } else {
      playerApiRef.current.play();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!timelineRef.current || !currentSongRef.current) return;
    timelineRef.current.scrollTo({
      top: currentSongRef.current.offsetTop,
      behavior: "smooth",
    });
  }, [nowPlaying?.id]);

  return (
    <div className="flex flex-col">
      <div className="p-4 bg-surface border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
          Now Playing
        </p>
        {nowPlaying ? (
          <>
            <div className="flex gap-3 md:flex-col md:gap-4 lg:gap-5">
              <div className="relative w-36 h-24 md:w-full md:max-w-2xl md:h-auto md:aspect-video md:mx-auto lg:max-w-3xl rounded-lg overflow-hidden bg-muted shrink-0">
                {isHost ? (
                  <YouTubeEmbed
                    videoId={nowPlaying.videoId}
                    onEnded={handleVideoEnded}
                    replayTrigger={replayTrigger}
                    onPlayStateChange={setIsPlaying}
                    playerApiRef={playerApiRef}
                  />
                ) : (
                  <img
                    src={nowPlaying.thumbnail}
                    alt={nowPlaying.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
                <h3 className="w-full min-w-0 overflow-hidden text-center font-bold text-sm text-foreground truncate md:text-lg">
                  {nowPlaying.title}
                </h3>
                <p className="mt-0.5 w-full min-w-0 truncate text-center text-xs text-primary md:text-sm">
                  Added by {nowPlaying.addedBy}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:gap-3 lg:gap-4">
              <button
                onClick={() => handleUpvote(nowPlaying.id)}
                className={`flex items-center gap-1 md:gap-1.5 text-xs md:text-sm rounded-full px-2.5 py-1 md:px-4 md:py-2 active:scale-95 transition-transform ${
                  upvoted.has(nowPlaying.id)
                    ? "bg-primary/20 text-primary"
                    : "bg-surface-elevated text-foreground"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5 md:h-5 md:w-5" />
                {nowPlaying.upvoteCount}
              </button>
              <button
                onClick={handleVeto}
                className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm bg-destructive/15 text-destructive rounded-full px-2.5 py-1 md:px-4 md:py-2 active:scale-95 transition-transform"
              >
                <ThumbsDown className="h-3.5 w-3.5 md:h-5 md:w-5" />
                Veto
              </button>
              {isHost && (
                <>
                  <button
                    onClick={handleSkip}
                    className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm bg-accent/15 text-accent rounded-full px-2.5 py-1 md:px-4 md:py-2 active:scale-95 transition-transform"
                  >
                    <SkipForward className="h-3.5 w-3.5 md:h-5 md:w-5" />
                    Skip
                  </button>
                  <button
                    onClick={handleLoop}
                    className={`flex items-center gap-1 md:gap-1.5 text-xs md:text-sm rounded-full px-2.5 py-1 md:px-4 md:py-2 active:scale-95 transition-transform ${
                      nowPlaying.loop
                        ? "bg-primary/20 text-primary"
                        : "bg-surface-elevated text-muted-foreground"
                    }`}
                  >
                    <Repeat className="h-3.5 w-3.5 md:h-5 md:w-5" />
                  </button>
                </>
              )}
            </div>

            {isHost && (
              <div className="flex items-center justify-center gap-6 mt-3 py-2">
                <button
                  onClick={handlePrevious}
                  disabled={playedQueue.length === 0}
                  className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-full bg-surface-elevated text-foreground disabled:text-muted-foreground/30 disabled:cursor-not-allowed active:scale-95 transition-transform"
                >
                  <SkipBack className="h-5 w-5 md:h-6 md:w-6" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="h-12 w-12 md:h-14 md:w-14 flex items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 transition-transform shadow-lg"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 md:h-6 md:w-6" />
                  ) : (
                    <Play className="h-5 w-5 md:h-6 md:w-6 ml-0.5" />
                  )}
                </button>
                <button
                  onClick={handleSkip}
                  className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-full bg-surface-elevated text-foreground active:scale-95 transition-transform"
                >
                  <SkipForward className="h-5 w-5 md:h-6 md:w-6" />
                </button>
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[10px] text-muted-foreground lg:text-xs">
                <span>Veto progress</span>
                <span>
                  {vetoCount}/{vetoNeeded}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-destructive transition-all"
                  style={{ width: `${vetoProgress * 100}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No song playing. Search and add one!
          </p>
        )}
      </div>

      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={atMaxSongs ? "Song limit reached" : "Search for a song..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={atMaxSongs}
            className="h-12 pl-10 rounded-xl bg-surface border-border text-sm"
          />
        </div>
        {atMaxSongs && (
          <p className="text-xs text-destructive mt-1.5 px-1">
            You've reached the max of {roomState.settings?.maxSongsPerUser ?? 3} songs in the queue.
          </p>
        )}
      </div>

      {(searchResults.length > 0 || searchLoading) && !atMaxSongs && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            {searchLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching...
              </span>
            ) : (
              `Results · ${searchResults.length}`
            )}
          </p>
          <div className="flex flex-col gap-2">
            {searchResults.map((result) => (
              <div
                key={result.videoId}
                className="flex min-w-0 items-center gap-3 p-2.5 rounded-xl bg-surface hover:bg-surface-elevated transition-colors"
              >
                <img
                  src={result.thumbnail}
                  alt={result.title}
                  className="w-12 h-9 rounded-md object-cover shrink-0"
                />
                <button
                  type="button"
                  onClick={() => handleSearchResultSelect(result)}
                  className="min-w-0 flex-1 overflow-hidden text-left touch-manipulation"
                >
                  <p className="text-sm font-medium text-foreground truncate min-w-0">
                    {result.title}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchResultSelect(result)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg bg-primary/15 text-primary hover:bg-primary/25 active:scale-95 transition-all shrink-0 touch-manipulation"
                  aria-label={`Add ${result.title}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isHost && pendingQueue && pendingQueue.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">
            Pending Approval · {pendingQueue.length}
          </p>
          <div className="flex flex-col gap-2">
            {pendingQueue.map((song, i) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20"
              >
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="w-12 h-9 rounded-md object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {song.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {song.addedBy}
                  </p>
                </div>
                <button
                  onClick={() => handleApproveSong(song.id)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 active:scale-95 transition-all shrink-0"
                  aria-label="Approve"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleRejectSong(song.id)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 active:scale-95 transition-all shrink-0"
                  aria-label="Reject"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Queue Timeline
        </p>
        <div ref={timelineRef} className="max-h-72 overflow-y-auto pr-1 lg:max-h-96">
          <div className="flex flex-col gap-2">
            {playedQueue.map((song, i) => (
              <motion.div
                key={`played-${song.id}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-surface/60 border border-border/60"
              >
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="w-12 h-9 rounded-md object-cover shrink-0 opacity-70"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground truncate">
                    {song.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    {song.addedBy}
                  </p>
                </div>
              </motion.div>
            ))}
            {nowPlaying && (
              <motion.div
                ref={(el) => {
                  currentSongRef.current = el;
                }}
                key={`current-${nowPlaying.id}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-primary/40 bg-primary/10"
              >
                <img
                  src={nowPlaying.thumbnail}
                  alt={nowPlaying.title}
                  className="w-12 h-9 rounded-md object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {nowPlaying.title}
                  </p>
                  <p className="text-[11px] text-primary">
                    Playing now · {nowPlaying.addedBy}
                  </p>
                </div>
                <button
                  onClick={() => handleUpvote(nowPlaying.id)}
                  className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1.5 active:scale-95 transition-all shrink-0 ${
                    upvoted.has(nowPlaying.id)
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-elevated text-muted-foreground"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {nowPlaying.upvoteCount}
                </button>
              </motion.div>
            )}
            {queue.map((song, i) => (
              <motion.div
                key={`upnext-${song.id}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-surface hover:bg-surface-elevated transition-colors"
              >
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="w-12 h-9 rounded-md object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {song.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {song.addedBy}
                  </p>
                </div>
                <button
                  onClick={() => handleUpvote(song.id)}
                  className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1.5 active:scale-95 transition-all shrink-0 ${
                    upvoted.has(song.id)
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-elevated text-muted-foreground"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {song.upvoteCount}
                </button>
              </motion.div>
            ))}
            {!nowPlaying && queue.length === 0 && playedQueue.length === 0 && (
              <p className="text-sm text-muted-foreground py-3 text-center">
                No songs in timeline yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardTab({
  leaderboard,
}: {
  leaderboard: LeaderboardEntry[];
}) {
  const avatars = [
    "\u{1F3A7}",
    "\u{1F3B5}",
    "\u{1F50A}",
    "\u2728",
    "\u{1F3A4}",
    "\u{1F4A5}",
    "\u{1F916}",
    "\u{1F300}",
    "\u{1F3B9}",
    "\u{1F941}",
  ];

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-foreground mb-4">
        {"\u{1F3C6}"} Leaderboard
      </h2>
      <div className="flex flex-col gap-2">
        {leaderboard.map((entry, i) => {
          const rankColors = [
            "border-gold bg-gold/10",
            "border-silver bg-silver/10",
            "border-bronze bg-bronze/10",
          ];
          const isTop3 = i < 3;
          const avatar = avatars[i % avatars.length];
          return (
            <motion.div
              key={entry.djName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                isTop3 ? `border ${rankColors[i]}` : "bg-surface"
              }`}
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                  isTop3 ? "font-bold" : "bg-surface-elevated"
                }`}
              >
                {isTop3 ? avatar : `#${i + 1}`}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {entry.djName}
                </p>
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  <span>{entry.songsQueued} queued</span>
                  <span>{entry.upvotesReceived} upvotes</span>
                </div>
              </div>
              {isTop3 && (
                <span className="text-2xl">
                  {i === 0
                    ? "\u{1F947}"
                    : i === 1
                      ? "\u{1F948}"
                      : "\u{1F949}"}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function RoomInfoTab({
  roomCode,
  members,
  isHost,
  settings,
  onUpdateSettings,
}: {
  roomCode: string;
  members: Member[];
  isHost: boolean;
  settings: RoomSettings;
  onUpdateSettings: (patch: Partial<RoomSettings>) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 py-8 rounded-2xl bg-surface border border-border"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Room Code
        </p>
        <button
          onClick={copyCode}
          className="flex items-center gap-3 px-6 py-3 rounded-xl bg-surface-elevated hover:bg-border active:scale-95 transition-all"
        >
          <span className="text-4xl font-bold tracking-[0.3em] text-foreground font-mono">
            {roomCode}
          </span>
          {copied ? (
            <Check className="h-5 w-5 text-green-400 shrink-0" />
          ) : (
            <Copy className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </button>
        <p className="text-xs text-muted-foreground">
          {copied ? "Copied!" : "Tap to copy · Share this code so others can join"}
        </p>
      </motion.div>

      {isHost && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-surface border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Host Settings
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ListMusic className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Max Songs Per User</p>
                  <p className="text-[11px] text-muted-foreground">Limit how many songs each DJ can queue</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onUpdateSettings({ maxSongsPerUser: Math.max(1, settings.maxSongsPerUser - 1) })}
                  className="h-7 w-7 flex items-center justify-center rounded-md bg-surface-elevated hover:bg-border active:scale-95 transition-all"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-bold text-foreground tabular-nums">
                  {settings.maxSongsPerUser}
                </span>
                <button
                  onClick={() => onUpdateSettings({ maxSongsPerUser: Math.min(50, settings.maxSongsPerUser + 1) })}
                  className="h-7 w-7 flex items-center justify-center rounded-md bg-surface-elevated hover:bg-border active:scale-95 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Require Approval</p>
                  <p className="text-[11px] text-muted-foreground">Songs go to a pending queue first</p>
                </div>
              </div>
              <Switch
                checked={settings.approvalMode}
                onCheckedChange={(val) => onUpdateSettings({ approvalMode: val })}
              />
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <Lock className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Lock Room</p>
                  <p className="text-[11px] text-muted-foreground">Prevent new users from joining</p>
                </div>
              </div>
              <Switch
                checked={settings.isLocked}
                onCheckedChange={(val) => onUpdateSettings({ isLocked: val })}
              />
            </div>
          </div>
        </motion.div>
      )}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Connected · {members.length}{" "}
          {members.length === 1 ? "person" : "people"}
        </p>
        <div className="flex flex-col gap-2">
          {members.map((member, i) => (
            <motion.div
              key={member.sid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface"
            >
              <div className="h-10 w-10 rounded-full bg-surface-elevated flex items-center justify-center shrink-0">
                {member.role === "host" ? (
                  <Crown className="h-5 w-5 text-accent" />
                ) : (
                  <Music className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {member.djName}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  member.role === "host"
                    ? "bg-accent/20 text-accent"
                    : "bg-primary/20 text-primary"
                }`}
              >
                {member.role === "host" ? "Host" : "DJ"}
              </span>
            </motion.div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No one connected yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
