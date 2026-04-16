export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  addedBy: string;
  addedByNorm: string;
  upvoteCount: number;
  loop: boolean;
}

export interface LeaderboardEntry {
  djName: string;
  songsQueued: number;
  upvotesReceived: number;
  songsVetoed: number;
}

export interface Member {
  sid: string;
  djName: string;
  role: "host" | "remote";
}

export interface RoomSettings {
  maxSongsPerUser: number;
  approvalMode: boolean;
  isLocked: boolean;
}

export interface RoomState {
  queue: QueueItem[];
  pendingQueue: QueueItem[];
  playedQueue: QueueItem[];
  nowPlaying: QueueItem | null;
  vetoCount: number;
  vetoNeeded: number;
  members: Member[];
  leaderboard: LeaderboardEntry[];
  settings: RoomSettings;
}

export interface SearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
}
