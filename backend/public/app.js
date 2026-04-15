(function () {
  var page = (document.body && document.body.getAttribute("data-page")) || "";

  function ioConnect() {
    return io({ transports: ["websocket", "polling"] });
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function roomFromUrl() {
    var p = new URLSearchParams(window.location.search);
    var r = p.get("room");
    return r ? r.trim().toUpperCase() : "";
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }

  function escHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function makeSearchController(cfg) {
    var requestId = 0;
    function render(items, error) {
      cfg.resultsEl.innerHTML = "";
      if (error) {
        var li = document.createElement("li");
        li.className = "q-item";
        li.innerHTML = '<div class="q-meta"><div class="q-title"></div></div>';
        li.querySelector(".q-title").textContent = error;
        cfg.resultsEl.appendChild(li);
        return;
      }
      items.forEach(function (it) {
        var li = document.createElement("li");
        li.className = "q-item";
        li.dataset.videoId = it.videoId;
        li.dataset.title = it.title || "";
        li.dataset.thumb = it.thumbnail || "";
        li.innerHTML =
          '<img alt="" /><div class="q-meta"><div class="q-title"></div><div class="q-by">Tap to add</div></div>';
        li.querySelector("img").src = it.thumbnail || "";
        li.querySelector(".q-title").textContent = it.title || "";
        cfg.resultsEl.appendChild(li);
      });
    }
    var run = debounce(function () {
      var q = cfg.inputEl.value.trim();
      if (!q) {
        cfg.resultsEl.innerHTML = "";
        return;
      }
      requestId += 1;
      var rid = requestId;
      fetch("/api/search?q=" + encodeURIComponent(q))
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (rid !== requestId) return;
          if (data && data.error === "missing_api_key") {
            render([], "Server missing YOUTUBE_API_KEY.");
            return;
          }
          if (data && data.error) {
            render([], "Search unavailable right now.");
            return;
          }
          render((data && data.items) || [], "");
        })
        .catch(function () {
          if (rid !== requestId) return;
          render([], "Search failed.");
        });
    }, 300);
    cfg.inputEl.addEventListener("input", run);
    cfg.resultsEl.addEventListener("click", function (e) {
      var li = e.target.closest(".q-item");
      if (!li || !li.dataset.videoId) return;
      cfg.onSelect({
        videoId: li.dataset.videoId,
        title: li.dataset.title || "",
        thumbnail: li.dataset.thumb || "",
      });
      cfg.inputEl.value = "";
      cfg.resultsEl.innerHTML = "";
    });
    document.addEventListener("click", function (e) {
      if (!cfg.rootEl.contains(e.target)) cfg.resultsEl.innerHTML = "";
    });
  }

  function renderLeaderboard(rootEl, payload) {
    rootEl.innerHTML = "";
    var base = (payload && payload.leaderboard) || [];
    function card(title, key) {
      var sorted = base.slice().sort(function (a, b) {
        if ((b[key] || 0) !== (a[key] || 0)) return (b[key] || 0) - (a[key] || 0);
        return String(a.djName).localeCompare(String(b.djName));
      });
      var wrap = document.createElement("div");
      wrap.className = "lb-card";
      var h = document.createElement("h3");
      h.textContent = title;
      wrap.appendChild(h);
      sorted.slice(0, 10).forEach(function (row, i) {
        var r = document.createElement("div");
        r.className = "lb-row";
        r.innerHTML =
          "<span>" + (i + 1) + ". " + escHtml(row.djName) + "</span><span>" + (row[key] || 0) + "</span>";
        wrap.appendChild(r);
      });
      if (!sorted.length) {
        var r = document.createElement("div");
        r.className = "lb-row";
        r.textContent = "No stats yet.";
        wrap.appendChild(r);
      }
      rootEl.appendChild(wrap);
    }
    card("Most Played", "songsQueued");
    card("Top DJ (Upvotes)", "upvotesReceived");
    card("Most Skipped", "songsVetoed");
  }

  function renderUserList(listEl, payload, mySid, nowPlayingByNorm) {
    listEl.innerHTML = "";
    var members = (payload && payload.members) || [];
    if (!members.length) {
      var li = document.createElement("li");
      li.className = "user-row";
      li.textContent = "No one here yet";
      listEl.appendChild(li);
      return;
    }
    members.forEach(function (m) {
      var li = document.createElement("li");
      li.className = "user-row";
      if (m.sid === mySid) li.classList.add("is-me");
      if (nowPlayingByNorm && m.djName && m.djName.toLowerCase() === nowPlayingByNorm) {
        li.classList.add("is-playing");
      }
      li.innerHTML =
        '<span class="user-name">' +
        escHtml(m.djName) +
        '</span><span class="user-badge">NOW PLAYING</span><span class="user-role">' +
        escHtml(m.role) +
        "</span>";
      listEl.appendChild(li);
    });
  }

  function wireStabs(container, mapping) {
    var tabs = container.querySelectorAll(".stab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (x) {
          x.classList.toggle("active", x === tab);
        });
        var attrs = tab.dataset;
        var val = attrs.stab || attrs.hostTab || attrs.side || "";
        Object.keys(mapping).forEach(function (k) {
          var el = mapping[k];
          if (el) el.style.display = val === k ? "block" : "none";
        });
      });
    });
  }

  if (page === "index") {
    var socket = ioConnect();
    var joinRoom = qs("#joinRoom");
    var joinName = qs("#joinName");
    var joinErr = qs("#joinErr");
    var createErr = qs("#createErr");
    var pre = roomFromUrl();
    if (pre) joinRoom.value = pre;
    qs("#btnCreate").addEventListener("click", function () {
      createErr.textContent = "";
      socket.emit("room:create", function (res) {
        if (!res || !res.roomCode) {
          createErr.textContent = "Could not create room.";
          return;
        }
        sessionStorage.setItem("djuke_hostToken", res.hostToken);
        sessionStorage.setItem("djuke_roomCode", res.roomCode);
        window.location.href = "host.html";
      });
    });
    qs("#btnJoin").addEventListener("click", function () {
      joinErr.textContent = "";
      var code = joinRoom.value.trim().toUpperCase();
      var name = joinName.value.trim();
      if (!code || !name) {
        joinErr.textContent = "Enter room code and DJ name.";
        return;
      }
      socket.emit("room:join", { roomCode: code, djName: name }, function (ack) {
        if (!ack || !ack.ok) {
          if (ack && ack.error === "name_taken") joinErr.textContent = "That DJ name is taken in this room.";
          else if (ack && ack.error === "room_not_found") joinErr.textContent = "Room not found.";
          else joinErr.textContent = "Could not join.";
          return;
        }
        sessionStorage.setItem("djuke_roomCode", ack.roomCode);
        sessionStorage.setItem("djuke_djName", ack.djName);
        window.location.href = "remote.html";
      });
    });
  }

  if (page === "host") {
    var roomCode = sessionStorage.getItem("djuke_roomCode");
    var hostToken = sessionStorage.getItem("djuke_hostToken");
    var statusEl = qs("#hostStatus");
    var codeEl = qs("#roomCodeDisplay");
    var joinUrlText = qs("#joinUrlText");
    var hostNowTitle = qs("#hostNowTitle");
    var hostNowBy = qs("#hostNowBy");
    var hostSearchQ = qs("#hostSearchQ");
    var hostSearchResults = qs("#hostSearchResults");
    var hostMembers = qs("#hostMembers");
    var hostQueueList = qs("#hostQueueList");
    var hostPanelRoom = qs("#hostPanelRoom");
    var hostPanelQueue = qs("#hostPanelQueue");
    var hostLbRoot = qs("#hostLbRoot");
    var hostSideMembers = qs("#hostSideMembers");
    var hostSideLb = qs("#hostSideLb");
    var btnLoop = qs("#btnLoop");
    var btnForceSkip = qs("#btnForceSkip");

    if (!roomCode || !hostToken) {
      statusEl.textContent = "Missing room. Go back to create a room.";
      window.location.href = "index.html";
    } else {
      var socket = ioConnect();
      var player = null;
      var lastVideoId = null;
      var qrBuilt = false;
      var lastNp = null;
      var isLooping = false;

      function applyNowPlaying(np) {
        if (np && np.videoId) {
          hostNowTitle.textContent = np.title || "";
          hostNowBy.textContent = np.addedBy || "—";
          isLooping = !!np.loop;
          btnLoop.textContent = isLooping ? "🔁 Loop On" : "🔁 Loop Off";
          btnLoop.classList.toggle("btn-loop-on", isLooping);
          btnLoop.classList.toggle("btn-ghost", !isLooping);
          if (player && player.loadVideoById && lastVideoId !== np.videoId) {
            lastVideoId = np.videoId;
            player.loadVideoById(np.videoId);
          }
        } else {
          hostNowTitle.textContent = "Waiting for music…";
          hostNowBy.textContent = "—";
          lastVideoId = null;
          isLooping = false;
          btnLoop.textContent = "🔁 Loop Off";
          btnLoop.classList.remove("btn-loop-on");
          btnLoop.classList.add("btn-ghost");
          if (player && player.stopVideo) player.stopVideo();
        }
      }

      function renderHostQueue(payload) {
        hostQueueList.innerHTML = "";
        var q = (payload && payload.queue) || [];
        if (!q.length) {
          var li = document.createElement("li");
          li.className = "q-item";
          li.innerHTML = '<div class="q-meta"><div class="q-title">Queue is empty</div></div>';
          hostQueueList.appendChild(li);
          return;
        }
        q.forEach(function (item) {
          var li = document.createElement("li");
          li.className = "q-item";
          li.innerHTML =
            '<img alt="" /><div class="q-meta"><div class="q-title"></div><div class="q-by"></div></div>';
          li.querySelector("img").src = item.thumbnail || "";
          li.querySelector(".q-title").textContent = item.title || "";
          li.querySelector(".q-by").textContent = "by " + (item.addedBy || "");
          hostQueueList.appendChild(li);
        });
      }

      function buildQr() {
        if (qrBuilt) return;
        var el = qs("#qrHost");
        if (!el || typeof QRCode === "undefined") return;
        while (el.firstChild) el.removeChild(el.firstChild);
        var joinUrl = window.location.origin + "/index.html?room=" + encodeURIComponent(roomCode);
        joinUrlText.textContent = joinUrl;
        new QRCode(el, {
          text: joinUrl,
          width: 400,
          height: 400,
        });
        qrBuilt = true;
      }

      function tryMountPlayer() {
        if (player) return;
        if (typeof YT === "undefined" || !YT.Player) return;
        player = new YT.Player("ytplayer", {
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1 },
          events: {
            onReady: function () {
              applyNowPlaying(lastNp);
            },
            onStateChange: function (ev) {
              if (ev.data === YT.PlayerState.ENDED) {
                socket.emit("host:ended", { roomCode: roomCode }, function () {});
              }
            },
          },
        });
      }

      window.__djukeMountPlayer = tryMountPlayer;

      codeEl.textContent = roomCode;
      socket.emit("room:hostJoin", { roomCode: roomCode, hostToken: hostToken }, function (ack) {
        if (!ack || !ack.ok) {
          statusEl.textContent = "Could not open boombox for this room.";
          return;
        }
        statusEl.textContent = "Live · Room " + roomCode;
        buildQr();
        makeSearchController({
          rootEl: hostSearchQ.parentElement,
          inputEl: hostSearchQ,
          resultsEl: hostSearchResults,
          onSelect: function (item) {
            socket.emit(
              "queue:add",
              { roomCode: roomCode, videoId: item.videoId, title: item.title, thumbnail: item.thumbnail },
              function () {}
            );
          },
        });
      });

      socket.on("queue:updated", function (payload) {
        lastNp = payload ? payload.nowPlaying : null;
        applyNowPlaying(lastNp);
        renderHostQueue(payload);
        var npNorm = lastNp && lastNp.addedBy ? lastNp.addedBy.toLowerCase() : null;
        renderUserList(hostMembers, payload, socket.id, npNorm);
        renderLeaderboard(hostLbRoot, payload);
      });

      socket.on("song:replay", function () {
        if (player && player.seekTo) {
          player.seekTo(0, true);
          player.playVideo();
        }
      });

      if (window.__djukeYtReady) tryMountPlayer();

      wireStabs(qs(".host-tabs-wrap"), { queue: hostPanelQueue, room: hostPanelRoom });
      wireStabs(qs(".host-sidebar"), { members: hostSideMembers, lb: hostSideLb });

      btnLoop.addEventListener("click", function () {
        socket.emit("host:loop", { roomCode: roomCode }, function () {});
      });

      btnForceSkip.addEventListener("click", function () {
        socket.emit("host:forceSkip", { roomCode: roomCode }, function () {});
      });
    }
  }

  if (page === "remote") {
    var gate = qs("#gate");
    var app = qs("#app");
    var gRoom = qs("#gRoom");
    var gName = qs("#gName");
    var gJoin = qs("#gJoin");
    var gErr = qs("#gErr");
    var remoteHead = qs("#remoteHead");
    var searchQ = qs("#searchQ");
    var searchResults = qs("#searchResults");
    var queueList = qs("#queueList");
    var nowEmpty = qs("#nowEmpty");
    var nowInner = qs("#nowInner");
    var nowThumb = qs("#nowThumb");
    var nowTitle = qs("#nowTitle");
    var nowBy = qs("#nowBy");
    var btnVeto = qs("#btnVeto");
    var btnUpNow = qs("#btnUpNow");
    var vetoBar = qs("#vetoBar");
    var lbRoot = qs("#lbRoot");
    var userListEl = qs("#userList");
    var stabUsers = qs("#stabUsers");
    var stabLb = qs("#stabLb");
    var socket = ioConnect();
    var roomCode = sessionStorage.getItem("djuke_roomCode") || "";
    var djName = sessionStorage.getItem("djuke_djName") || "";
    var joined = false;

    var ru = roomFromUrl();
    if (ru) gRoom.value = ru;

    function showGate() {
      gate.style.display = "";
      app.style.display = "none";
    }

    function showApp() {
      gate.style.display = "none";
      app.style.display = "";
      remoteHead.textContent = djName + " · Room " + roomCode;
    }

    function tryAutoJoin() {
      if (joined) return;
      if (!roomCode || !djName) {
        showGate();
        return;
      }
      socket.emit("room:join", { roomCode: roomCode, djName: djName }, function (ack) {
        if (!ack || !ack.ok) {
          showGate();
          gRoom.value = roomCode || gRoom.value;
          gName.value = djName || gName.value;
          roomCode = "";
          djName = "";
          sessionStorage.removeItem("djuke_roomCode");
          sessionStorage.removeItem("djuke_djName");
          return;
        }
        joined = true;
        roomCode = ack.roomCode;
        djName = ack.djName;
        sessionStorage.setItem("djuke_roomCode", roomCode);
        sessionStorage.setItem("djuke_djName", djName);
        showApp();
      });
    }

    gJoin.addEventListener("click", function () {
      gErr.textContent = "";
      roomCode = gRoom.value.trim().toUpperCase();
      djName = gName.value.trim();
      if (!roomCode || !djName) {
        gErr.textContent = "Enter room and DJ name.";
        return;
      }
      socket.emit("room:join", { roomCode: roomCode, djName: djName }, function (ack) {
        if (!ack || !ack.ok) {
          if (ack && ack.error === "name_taken") gErr.textContent = "That DJ name is taken.";
          else if (ack && ack.error === "room_not_found") gErr.textContent = "Room not found.";
          else gErr.textContent = "Could not join.";
          return;
        }
        joined = true;
        roomCode = ack.roomCode;
        djName = ack.djName;
        sessionStorage.setItem("djuke_roomCode", roomCode);
        sessionStorage.setItem("djuke_djName", djName);
        showApp();
      });
    });

    tryAutoJoin();

    function renderQueue(payload) {
      queueList.innerHTML = "";
      if (payload && payload.nowPlaying) {
        nowEmpty.style.display = "none";
        nowInner.style.display = "block";
        var np = payload.nowPlaying;
        nowThumb.src = np.thumbnail || "";
        nowThumb.alt = np.title || "";
        nowTitle.textContent = np.title || "";
        nowBy.textContent = np.addedBy || "";
        nowInner.dataset.itemId = np.id;
        var need = payload.vetoNeeded || 0;
        var have = payload.vetoCount || 0;
        vetoBar.textContent = need ? "Votes to skip: " + have + " / " + need : "";
      } else {
        nowEmpty.style.display = "block";
        nowInner.style.display = "none";
        vetoBar.textContent = "";
      }
      if (payload && payload.queue) {
        payload.queue.forEach(function (item) {
          var li = document.createElement("li");
          li.className = "q-item";
          li.innerHTML =
            '<img alt="" /><div class="q-meta"><div class="q-title"></div><div class="q-by"></div></div><button type="button" class="btn btn-small btn-ghost btn-up">Upvote 👍</button>';
          li.querySelector("img").src = item.thumbnail || "";
          li.querySelector(".q-title").textContent = item.title || "";
          li.querySelector(".q-by").textContent = "by " + (item.addedBy || "");
          li.dataset.itemId = item.id;
          queueList.appendChild(li);
        });
      }
    }

    socket.on("queue:updated", function (payload) {
      renderQueue(payload);
      var npNorm =
        payload && payload.nowPlaying && payload.nowPlaying.addedBy
          ? payload.nowPlaying.addedBy.toLowerCase()
          : null;
      renderUserList(userListEl, payload, socket.id, npNorm);
      renderLeaderboard(lbRoot, payload);
    });

    wireStabs(qs(".remote-sidebar"), { users: stabUsers, lb: stabLb });

    makeSearchController({
      rootEl: qs(".remote-search-block"),
      inputEl: searchQ,
      resultsEl: searchResults,
      onSelect: function (item) {
        if (!joined) return;
        socket.emit(
          "queue:add",
          { roomCode: roomCode, videoId: item.videoId, title: item.title, thumbnail: item.thumbnail },
          function () {}
        );
      },
    });

    queueList.addEventListener("click", function (e) {
      var btn = e.target.closest(".btn-up");
      if (!btn || !joined) return;
      var li = btn.closest(".q-item");
      if (!li) return;
      var itemId = li.dataset.itemId;
      if (!itemId) return;
      socket.emit("queue:upvote", { roomCode: roomCode, itemId: itemId }, function () {});
    });

    btnUpNow.addEventListener("click", function () {
      if (!joined || !nowInner.dataset.itemId) return;
      socket.emit("queue:upvote", { roomCode: roomCode, itemId: nowInner.dataset.itemId }, function () {});
    });

    btnVeto.addEventListener("click", function () {
      if (!joined) return;
      socket.emit("queue:veto", { roomCode: roomCode }, function () {});
    });
  }
})();
