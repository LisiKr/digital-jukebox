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

export interface RoomState {
  queue: QueueItem[];
  nowPlaying: QueueItem | null;
  vetoCount: number;
  vetoNeeded: number;
  members: Member[];
  leaderboard: LeaderboardEntry[];
}

export interface SearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
}
