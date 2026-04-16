require("dotenv").config();
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    res.status(500).json({ items: [], error: "missing_api_key" });
    return;
  }
  if (!q) {
    res.json({ items: [] });
    return;
  }
  try {
    const u = new URL("https://www.googleapis.com/youtube/v3/search");
    u.searchParams.set("part", "snippet");
    u.searchParams.set("type", "video");
    u.searchParams.set("maxResults", "15");
    u.searchParams.set("q", q);
    u.searchParams.set("key", key);
    const r = await fetch(u.toString());
    const data = await r.json();
    if (!r.ok) {
      res.status(502).json({ items: [], error: "youtube_error" });
      return;
    }
    const items = (data.items || [])
      .map((it) => ({
        videoId: it.id && it.id.videoId,
        title: it.snippet && it.snippet.title,
        thumbnail:
          it.snippet &&
          it.snippet.thumbnails &&
          it.snippet.thumbnails.medium &&
          it.snippet.thumbnails.medium.url,
      }))
      .filter((x) => x.videoId);
    res.json({ items });
  } catch {
    res.status(502).json({ items: [], error: "fetch_failed" });
  }
});

const rooms = new Map();

function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

function makeRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function makeHostToken() {
  return crypto.randomBytes(16).toString("hex");
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function ensureStat(room, norm, display) {
  if (!room.stats[norm]) {
    room.stats[norm] = {
      djName: display,
      songsQueued: 0,
      upvotesReceived: 0,
      songsVetoed: 0,
    };
  }
}

function getRemoteBySocketId(room, socketId) {
  for (const remote of room.remotes.values()) {
    if (remote.socketId === socketId) return remote;
  }
  return null;
}

function getMemberForQueue(room, socket) {
  if (socket.data.role === "host") {
    return { norm: "host", djName: "Host" };
  }
  if (socket.data.role === "remote") {
    const m = getRemoteBySocketId(room, socket.id);
    if (m) return { norm: m.norm, djName: m.djName };
  }
  return null;
}

function vetoThreshold(room) {
  let n = 0;
  for (const remote of room.remotes.values()) {
    if (remote.socketId) n++;
  }
  if (n <= 0) return Infinity;
  return Math.ceil(n / 2);
}

function serializeQueueItem(item) {
  return {
    id: item.id,
    videoId: item.videoId,
    title: item.title,
    thumbnail: item.thumbnail,
    addedBy: item.addedBy,
    addedByNorm: item.addedByNorm,
    upvoteCount: item.upvotedBy.size,
    loop: !!item.loop,
  };
}

function getStatePayload(room) {
  const members = [];
  if (room.hostSocketId) {
    members.push({ sid: room.hostSocketId, djName: "Host", role: "host" });
  }
  for (const m of room.remotes.values()) {
    if (m.socketId) {
      members.push({ sid: m.socketId, djName: m.djName, role: "remote" });
    }
  }
  return {
    queue: room.queue.map(serializeQueueItem),
    pendingQueue: room.pendingQueue.map(serializeQueueItem),
    playedQueue: room.playedQueue.map(serializeQueueItem),
    nowPlaying: room.nowPlaying ? serializeQueueItem(room.nowPlaying) : null,
    vetoCount: room.nowPlaying ? room.vetoBySocket.size : 0,
    vetoNeeded: room.nowPlaying ? vetoThreshold(room) : 0,
    members,
    settings: room.settings,
    leaderboard: Object.values(room.stats).sort((a, b) => {
      const t =
        b.upvotesReceived +
        b.songsQueued +
        b.songsVetoed -
        (a.upvotesReceived + a.songsQueued + a.songsVetoed);
      if (t !== 0) return t;
      return String(a.djName).localeCompare(String(b.djName));
    }),
  };
}

function broadcastState(room) {
  io.to(room.code).emit("queue:updated", getStatePayload(room));
}

function clearVetoes(room) {
  room.vetoBySocket.clear();
}

function advanceQueue(room, wasVeto) {
  if (room.nowPlaying) {
    const cur = room.nowPlaying;
    room.playedQueue.push(cur);
    if (wasVeto) {
      ensureStat(room, cur.addedByNorm, cur.addedBy);
      room.stats[cur.addedByNorm].songsVetoed += 1;
    }
  }
  room.nowPlaying = null;
  clearVetoes(room);
  if (room.queue.length > 0) {
    room.nowPlaying = room.queue.shift();
    room.nowPlaying.upvotedBy = new Set();
  }
  broadcastState(room);
  if (room.hostSocketId) {
    io.to(room.hostSocketId).emit("skipSong", {
      reason: wasVeto ? "veto" : "next",
      nowPlaying: room.nowPlaying ? serializeQueueItem(room.nowPlaying) : null,
    });
  }
}

function playPrevious(room) {
  if (!room.playedQueue.length) return false;
  const previous = room.playedQueue.pop();
  if (!previous) return false;
  if (room.nowPlaying) {
    room.queue.unshift(room.nowPlaying);
  }
  room.nowPlaying = previous;
  room.nowPlaying.upvotedBy = room.nowPlaying.upvotedBy || new Set();
  clearVetoes(room);
  broadcastState(room);
  return true;
}

function getRoom(code) {
  if (!code) return null;
  return rooms.get(String(code).trim().toUpperCase()) || null;
}

io.on("connection", (socket) => {
  socket.on("room:create", (cb) => {
    let code = makeRoomCode();
    while (rooms.has(code)) code = makeRoomCode();
    const hostToken = makeHostToken();
    const room = {
      code,
      hostToken,
      hostUserId: null,
      hostSocketId: null,
      remotes: new Map(),
      queue: [],
      pendingQueue: [],
      playedQueue: [],
      nowPlaying: null,
      vetoBySocket: new Set(),
      stats: {},
      settings: {
        maxSongsPerUser: 3,
        approvalMode: false,
        isLocked: false,
      },
    };
    rooms.set(code, room);
    if (typeof cb === "function") cb({ roomCode: code, hostToken });
  });

  socket.on("room:hostJoin", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const hostToken = payload && payload.hostToken;
    const userId = payload && payload.userId;
    const room = getRoom(roomCode);
    if (!room || room.hostToken !== hostToken) {
      if (typeof cb === "function") cb({ ok: false, error: "invalid_host" });
      return;
    }
    room.hostSocketId = socket.id;
    room.hostUserId = userId || room.hostUserId;
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = "host";
    socket.data.userId = userId || null;
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true, state: getStatePayload(room) });
  });

  socket.on("room:join", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const djNameRaw = payload && payload.djName;
    const userId = payload && payload.userId;
    const room = getRoom(roomCode);
    const display = String(djNameRaw || "").trim();
    const norm = normalizeName(display);
    if (!room) {
      if (typeof cb === "function") cb({ ok: false, error: "room_not_found" });
      return;
    }
    if (room.settings.isLocked) {
      if (typeof cb === "function") cb({ ok: false, error: "room_locked" });
      return;
    }
    if (!norm) {
      if (typeof cb === "function") cb({ ok: false, error: "name_required" });
      return;
    }
    if (!userId) {
      if (typeof cb === "function") cb({ ok: false, error: "user_id_required" });
      return;
    }
    const existingByUserId = room.remotes.get(userId);
    if (existingByUserId && existingByUserId.socketId) {
      if (typeof cb === "function") cb({ ok: false, error: "already_joined" });
      return;
    }
    for (const m of room.remotes.values()) {
      if (m.userId === userId) continue;
      if (m.norm === norm) {
        if (typeof cb === "function") cb({ ok: false, error: "name_taken" });
        return;
      }
    }
    room.remotes.set(userId, {
      userId,
      norm,
      djName: display,
      socketId: socket.id,
    });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = "remote";
    socket.data.userId = userId;
    socket.data.djNorm = norm;
    socket.data.djName = display;
    ensureStat(room, norm, display);
    broadcastState(room);
    if (typeof cb === "function")
      cb({ ok: true, roomCode: room.code, djName: display, state: getStatePayload(room) });
  });

  socket.on("room:rejoin", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const userId = payload && payload.userId;
    const isHost = !!(payload && payload.isHost);
    const djNameRaw = payload && payload.username;
    const room = getRoom(roomCode);
    if (!room) {
      if (typeof cb === "function") cb({ ok: false, error: "room_not_found" });
      return;
    }
    if (!userId) {
      if (typeof cb === "function") cb({ ok: false, error: "user_id_required" });
      return;
    }
    if (isHost) {
      if (!room.hostUserId || room.hostUserId !== userId) {
        if (typeof cb === "function") cb({ ok: false, error: "rejoin_denied" });
        return;
      }
      room.hostSocketId = socket.id;
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.role = "host";
      socket.data.userId = userId;
      broadcastState(room);
      if (typeof cb === "function") cb({ ok: true, state: getStatePayload(room) });
      return;
    }
    const remote = room.remotes.get(userId);
    if (!remote) {
      if (typeof cb === "function") cb({ ok: false, error: "rejoin_denied" });
      return;
    }
    const display = String(djNameRaw || remote.djName || "").trim();
    const norm = normalizeName(display);
    if (!norm) {
      if (typeof cb === "function") cb({ ok: false, error: "name_required" });
      return;
    }
    remote.socketId = socket.id;
    remote.djName = display;
    remote.norm = norm;
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = "remote";
    socket.data.userId = userId;
    socket.data.djNorm = norm;
    socket.data.djName = display;
    ensureStat(room, norm, display);
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true, state: getStatePayload(room) });
  });

  socket.on("queue:add", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const room = getRoom(roomCode);
    if (
      !room ||
      socket.data.roomCode !== room.code ||
      (socket.data.role !== "remote" && socket.data.role !== "host")
    ) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    const videoId = payload && payload.videoId;
    const title = (payload && payload.title) || "";
    const thumbnail = (payload && payload.thumbnail) || "";
    if (!videoId) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    const member = getMemberForQueue(room, socket);
    const addedBy = member ? member.djName : "DJ";
    const addedByNorm = member ? member.norm : normalizeName(addedBy);
    if (socket.data.role === "remote") {
      let userCount = 0;
      if (room.nowPlaying && room.nowPlaying.addedByNorm === addedByNorm) userCount++;
      for (const q of room.queue) if (q.addedByNorm === addedByNorm) userCount++;
      for (const q of room.pendingQueue) if (q.addedByNorm === addedByNorm) userCount++;
      if (userCount >= room.settings.maxSongsPerUser) {
        if (typeof cb === "function") cb({ ok: false, error: "max_songs_reached" });
        return;
      }
    }
    ensureStat(room, addedByNorm, addedBy);
    room.stats[addedByNorm].songsQueued += 1;
    const item = {
      id: randomId(),
      videoId,
      title,
      thumbnail,
      addedBy,
      addedByNorm,
      upvotedBy: new Set(),
      loop: false,
    };
    if (room.settings.approvalMode && socket.data.role === "remote") {
      room.pendingQueue.push(item);
      broadcastState(room);
      if (typeof cb === "function") cb({ ok: true, pending: true });
      return;
    }
    room.queue.push(item);
    if (!room.nowPlaying) {
      room.nowPlaying = room.queue.shift();
      room.nowPlaying.upvotedBy = new Set();
      clearVetoes(room);
    }
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("queue:upvote", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const itemId = payload && payload.itemId;
    const room = getRoom(roomCode);
    if (
      !room ||
      socket.data.role !== "remote" ||
      socket.data.roomCode !== room.code
    ) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    const list = [];
    if (room.nowPlaying && room.nowPlaying.id === itemId)
      list.push(room.nowPlaying);
    for (const q of room.queue) if (q.id === itemId) list.push(q);
    const target = list[0];
    if (!target) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (target.upvotedBy.has(socket.id)) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    target.upvotedBy.add(socket.id);
    ensureStat(room, target.addedByNorm, target.addedBy);
    room.stats[target.addedByNorm].upvotesReceived += 1;
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("queue:veto", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const room = getRoom(roomCode);
    if (
      !room ||
      socket.data.role !== "remote" ||
      socket.data.roomCode !== room.code
    ) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (!room.nowPlaying) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (room.remotes.size <= 0) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (room.vetoBySocket.has(socket.id)) {
      if (typeof cb === "function") cb({ ok: true, triggered: false });
      return;
    }
    room.vetoBySocket.add(socket.id);
    if (room.vetoBySocket.size >= vetoThreshold(room)) {
      advanceQueue(room, true);
      if (typeof cb === "function") cb({ ok: true, triggered: true });
      return;
    }
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true, triggered: false });
  });

  socket.on("host:ended", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const room = getRoom(roomCode);
    if (
      !room ||
      socket.data.role !== "host" ||
      room.hostSocketId !== socket.id
    ) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (room.nowPlaying && room.nowPlaying.loop) {
      broadcastState(room);
      io.to(room.hostSocketId).emit("song:replay");
      if (typeof cb === "function") cb({ ok: true, looped: true });
      return;
    }
    advanceQueue(room, false);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("host:loop", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const room = getRoom(roomCode);
    if (
      !room ||
      socket.data.role !== "host" ||
      room.hostSocketId !== socket.id
    ) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (!room.nowPlaying) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    room.nowPlaying.loop = !room.nowPlaying.loop;
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true, loop: room.nowPlaying.loop });
  });

  socket.on("host:forceSkip", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const room = getRoom(roomCode);
    if (
      !room ||
      socket.data.role !== "host" ||
      room.hostSocketId !== socket.id
    ) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    advanceQueue(room, false);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("host:previous", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const room = getRoom(roomCode);
    if (
      !room ||
      socket.data.role !== "host" ||
      room.hostSocketId !== socket.id
    ) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    const moved = playPrevious(room);
    if (typeof cb === "function") cb({ ok: moved });
  });

  socket.on("host:updateSettings", (payload, cb) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || socket.data.role !== "host" || room.hostSocketId !== socket.id) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    if (typeof payload.maxSongsPerUser === "number") {
      room.settings.maxSongsPerUser = Math.max(1, Math.min(50, Math.floor(payload.maxSongsPerUser)));
    }
    if (typeof payload.approvalMode === "boolean") {
      room.settings.approvalMode = payload.approvalMode;
    }
    if (typeof payload.isLocked === "boolean") {
      room.settings.isLocked = payload.isLocked;
    }
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("host:approveSong", (payload, cb) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || socket.data.role !== "host" || room.hostSocketId !== socket.id) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    const itemId = payload && payload.itemId;
    const idx = room.pendingQueue.findIndex((i) => i.id === itemId);
    if (idx === -1) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    const [item] = room.pendingQueue.splice(idx, 1);
    room.queue.push(item);
    if (!room.nowPlaying) {
      room.nowPlaying = room.queue.shift();
      room.nowPlaying.upvotedBy = new Set();
      clearVetoes(room);
    }
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("host:rejectSong", (payload, cb) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || socket.data.role !== "host" || room.hostSocketId !== socket.id) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    const itemId = payload && payload.itemId;
    const idx = room.pendingQueue.findIndex((i) => i.id === itemId);
    if (idx === -1) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    room.pendingQueue.splice(idx, 1);
    broadcastState(room);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("room:requestSync", () => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;
    socket.emit("queue:updated", getStatePayload(room));
  });

  socket.on("room:close", (payload, cb) => {
    const roomCode = payload && payload.roomCode;
    const room = getRoom(roomCode || socket.data.roomCode);
    if (
      !room ||
      socket.data.role !== "host" ||
      room.hostSocketId !== socket.id
    ) {
      if (typeof cb === "function") cb({ ok: false });
      return;
    }
    io.to(room.code).emit("room:destroyed");
    const sids = io.sockets.adapter.rooms.get(room.code);
    if (sids) {
      for (const sid of sids) {
        const target = io.sockets.sockets.get(sid);
        if (target) {
          target.leave(room.code);
          target.data.roomCode = null;
          target.data.role = null;
          target.data.userId = null;
          target.data.djNorm = null;
          target.data.djName = null;
        }
      }
    }
    rooms.delete(room.code);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    if (socket.data.role === "remote") {
      const remote = getRemoteBySocketId(room, socket.id);
      if (remote) remote.socketId = null;
      room.vetoBySocket.delete(socket.id);
    }
    if (socket.data.role === "host" && room.hostSocketId === socket.id) {
      room.hostSocketId = null;
    }
    broadcastState(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {});
