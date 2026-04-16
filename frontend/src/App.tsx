import { useState, useCallback, useRef, useEffect } from "react";
import { WelcomeScreen } from "@/components/jukebox/WelcomeScreen";
import { JoinFlow } from "@/components/jukebox/JoinFlow";
import { ProfileSetup } from "@/components/jukebox/ProfileSetup";
import { RoomView } from "@/components/jukebox/RoomView";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { RoomState } from "@/components/jukebox/mockData";

type AppStep = "welcome" | "join" | "profile" | "room";
const SESSION_STORAGE_KEY = "jukebox_session";

type SessionPayload = {
  roomCode: string;
  username: string;
  isHost: boolean;
  userId: string;
};

function makeUserId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function App() {
  const [step, setStep] = useState<AppStep>("welcome");
  const [isHost, setIsHost] = useState(false);
  const [djName, setDjName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialRoomState, setInitialRoomState] = useState<RoomState | null>(null);
  const hasTriedRestoreRef = useRef(false);
  const hostTokenRef = useRef("");

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const saveSession = useCallback((session: SessionPayload) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, []);

  const handleHost = () => {
    setIsHost(true);
    setError("");
    setStep("profile");
  };

  const handleJoin = () => {
    setIsHost(false);
    setError("");
    setStep("join");
  };

  const handleJoinNext = (code: string) => {
    setRoomCode(code.toUpperCase());
    setError("");
    setStep("profile");
  };

  const handleEnterRoom = useCallback(
    (name: string) => {
      setDjName(name);
      setError("");
      setLoading(true);

      const socket = getSocket();
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      let parsed: SessionPayload | null = null;
      if (stored) {
        try {
          parsed = JSON.parse(stored) as SessionPayload;
        } catch {
          parsed = null;
        }
      }
      const userId = parsed?.userId || makeUserId();

      if (isHost) {
        socket.emit(
          "room:create",
          (res: { roomCode: string; hostToken: string }) => {
            hostTokenRef.current = res.hostToken;
            setRoomCode(res.roomCode);
            socket.emit(
              "room:hostJoin",
              { roomCode: res.roomCode, hostToken: res.hostToken, userId },
              (joinRes: { ok: boolean; error?: string; state?: RoomState }) => {
                setLoading(false);
                if (joinRes.ok) {
                  if (joinRes.state) setInitialRoomState(joinRes.state);
                  saveSession({
                    roomCode: res.roomCode,
                    username: name,
                    isHost: true,
                    userId,
                  });
                  setStep("room");
                } else {
                  setError(joinRes.error || "Failed to create room");
                }
              },
            );
          },
        );
      } else {
        socket.emit(
          "room:join",
          { roomCode, djName: name, userId },
          (res: { ok: boolean; error?: string; state?: RoomState }) => {
            setLoading(false);
            if (res.ok) {
              if (res.state) setInitialRoomState(res.state);
              saveSession({
                roomCode,
                username: name,
                isHost: false,
                userId,
              });
              setStep("room");
            } else {
              setError(res.error || "Failed to join room");
            }
          },
        );
      }
    },
    [isHost, roomCode, saveSession],
  );

  const handleLeave = useCallback(() => {
    clearSession();
    disconnectSocket();
    setStep("welcome");
    setIsHost(false);
    setDjName("");
    setRoomCode("");
    setError("");
    setInitialRoomState(null);
    hostTokenRef.current = "";
  }, [clearSession]);

  const handleRoomDestroyed = useCallback(() => {
    clearSession();
    alert("The host has ended the room");
    disconnectSocket();
    setStep("welcome");
    setIsHost(false);
    setDjName("");
    setRoomCode("");
    setError("");
    setInitialRoomState(null);
    hostTokenRef.current = "";
  }, [clearSession]);

  const handleCloseRoom = useCallback(() => {
    const socket = getSocket();
    socket.emit("room:close", { roomCode });
  }, [roomCode]);

  useEffect(() => {
    const socket = getSocket();
    const onRoomDestroyed = () => {
      handleRoomDestroyed();
    };
    socket.on("room:destroyed", onRoomDestroyed);
    return () => {
      socket.off("room:destroyed", onRoomDestroyed);
    };
  }, [handleRoomDestroyed]);

  useEffect(() => {
    if (hasTriedRestoreRef.current) return;
    hasTriedRestoreRef.current = true;
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return;
    let session: SessionPayload | null = null;
    try {
      session = JSON.parse(stored) as SessionPayload;
    } catch {
      clearSession();
      return;
    }
    if (!session?.roomCode || !session?.username || !session?.userId) {
      clearSession();
      return;
    }
    const socket = getSocket();
    setLoading(true);
    socket.emit(
      "room:rejoin",
      {
        roomCode: session.roomCode,
        username: session.username,
        isHost: session.isHost,
        userId: session.userId,
      },
      (res: { ok: boolean; error?: string; state?: RoomState }) => {
        setLoading(false);
        if (!res.ok) {
          clearSession();
          return;
        }
        setIsHost(session.isHost);
        setDjName(session.username);
        setRoomCode(session.roomCode);
        setError("");
        if (res.state) setInitialRoomState(res.state);
        setStep("room");
      },
    );
  }, [clearSession]);

  switch (step) {
    case "welcome":
      return <WelcomeScreen onHost={handleHost} onJoin={handleJoin} />;
    case "join":
      return (
        <JoinFlow
          onNext={handleJoinNext}
          onBack={() => setStep("welcome")}
        />
      );
    case "profile":
      return (
        <ProfileSetup
          onEnter={handleEnterRoom}
          onBack={() => {
            setError("");
            setStep(isHost ? "welcome" : "join");
          }}
          error={error}
          loading={loading}
        />
      );
    case "room":
      return (
        <RoomView
          isHost={isHost}
          djName={djName}
          roomCode={roomCode}
          onLeave={handleLeave}
          onCloseRoom={handleCloseRoom}
          initialState={initialRoomState}
        />
      );
  }
}
