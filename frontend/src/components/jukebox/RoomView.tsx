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
  Trash2,
  Save,
  DoorOpen,
  Plus,
  Repeat,
  Loader2,
  Users,
  Copy,
  Check,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSocket } from "@/lib/socket";
import type {
  QueueItem,
  LeaderboardEntry,
  Member,
  RoomState,
  SearchResult,
} from "./mockData";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

interface RoomViewProps {
  isHost: boolean;
  djName: string;
  roomCode: string;
  onLeave: () => void;
  initialState?: RoomState | null;
}

export function RoomView({ isHost, djName, roomCode, onLeave, initialState }: RoomViewProps) {
  const [tab, setTab] = useState<"queue" | "leaderboard" | "room">("queue");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const defaultState: RoomState = {
    queue: [],
    nowPlaying: null,
    vetoCount: 0,
    vetoNeeded: 0,
    members: [],
    leaderboard: [],
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
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface active:bg-border transition-colors text-destructive">
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

      <main className="flex-1 overflow-y-auto pb-20">
        {tab === "queue" && (
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
            handleLoop={handleLoop}
            handleAddSong={handleAddSong}
            handleVideoEnded={handleVideoEnded}
            replayTrigger={replayTrigger}
          />
        )}
        {tab === "leaderboard" && (
          <LeaderboardTab leaderboard={roomState.leaderboard} />
        )}
        {tab === "room" && (
          <RoomInfoTab
            roomCode={roomCode}
            members={roomState.members}
            isHost={isHost}
          />
        )}
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
}: {
  videoId: string;
  onEnded: () => void;
  replayTrigger: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

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
          },
        },
      });
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
  handleLoop,
  handleAddSong,
  handleVideoEnded,
  replayTrigger,
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
  handleLoop: () => void;
  handleAddSong: (result: SearchResult) => void;
  handleVideoEnded: () => void;
  replayTrigger: number;
}) {
  const { nowPlaying, queue, vetoCount, vetoNeeded } = roomState;
  const vetoProgress = vetoNeeded > 0 ? vetoCount / vetoNeeded : 0;
  const handleSearchResultSelect = useCallback(
    (result: SearchResult) => {
      handleAddSong(result);
    },
    [handleAddSong],
  );

  return (
    <div className="flex flex-col">
      <div className="p-4 bg-surface border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
          Now Playing
        </p>
        {nowPlaying ? (
          <>
            <div className="flex gap-3 md:flex-col md:gap-4">
              <div className="relative w-28 h-20 md:w-full md:h-auto md:aspect-video rounded-lg overflow-hidden bg-muted shrink-0">
                {isHost ? (
                  <YouTubeEmbed
                    videoId={nowPlaying.videoId}
                    onEnded={handleVideoEnded}
                    replayTrigger={replayTrigger}
                  />
                ) : (
                  <img
                    src={nowPlaying.thumbnail}
                    alt={nowPlaying.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm md:text-lg text-foreground truncate">
                  {nowPlaying.title}
                </h3>
                <p className="text-xs md:text-sm text-primary mt-0.5">
                  Added by {nowPlaying.addedBy}
                </p>
                <div className="flex items-center gap-2 md:gap-3 mt-2 md:mt-3 flex-wrap">
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
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
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
            placeholder="Search for a song..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 pl-10 rounded-xl bg-surface border-border text-sm"
          />
        </div>
      </div>

      {(searchResults.length > 0 || searchLoading) && (
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
                className="flex items-center gap-3 p-2.5 rounded-xl bg-surface hover:bg-surface-elevated transition-colors"
              >
                <img
                  src={result.thumbnail}
                  alt={result.title}
                  className="w-12 h-9 rounded-md object-cover shrink-0"
                />
                <button
                  type="button"
                  onClick={() => handleSearchResultSelect(result)}
                  className="flex-1 text-left touch-manipulation"
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

      <div className="px-4 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Up Next · {queue.length} songs
        </p>
        <div className="flex flex-col gap-2">
          {queue.map((song, i) => (
            <motion.div
              key={song.id}
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
}: {
  roomCode: string;
  members: Member[];
  isHost: boolean;
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
