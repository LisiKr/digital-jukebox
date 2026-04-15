import { useState, useCallback, useRef } from "react";
import { WelcomeScreen } from "@/components/jukebox/WelcomeScreen";
import { JoinFlow } from "@/components/jukebox/JoinFlow";
import { ProfileSetup } from "@/components/jukebox/ProfileSetup";
import { RoomView } from "@/components/jukebox/RoomView";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { RoomState } from "@/components/jukebox/mockData";

type AppStep = "welcome" | "join" | "profile" | "room";

export default function App() {
  const [step, setStep] = useState<AppStep>("welcome");
  const [isHost, setIsHost] = useState(false);
  const [djName, setDjName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialRoomState, setInitialRoomState] = useState<RoomState | null>(null);
  const hostTokenRef = useRef("");

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

      if (isHost) {
        socket.emit(
          "room:create",
          (res: { roomCode: string; hostToken: string }) => {
            hostTokenRef.current = res.hostToken;
            setRoomCode(res.roomCode);
            socket.emit(
              "room:hostJoin",
              { roomCode: res.roomCode, hostToken: res.hostToken },
              (joinRes: { ok: boolean; error?: string; state?: RoomState }) => {
                setLoading(false);
                if (joinRes.ok) {
                  if (joinRes.state) setInitialRoomState(joinRes.state);
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
          { roomCode, djName: name },
          (res: { ok: boolean; error?: string; state?: RoomState }) => {
            setLoading(false);
            if (res.ok) {
              if (res.state) setInitialRoomState(res.state);
              setStep("room");
            } else {
              setError(res.error || "Failed to join room");
            }
          },
        );
      }
    },
    [isHost, roomCode],
  );

  const handleLeave = useCallback(() => {
    disconnectSocket();
    setStep("welcome");
    setIsHost(false);
    setDjName("");
    setRoomCode("");
    setError("");
    setInitialRoomState(null);
    hostTokenRef.current = "";
  }, []);

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
          initialState={initialRoomState}
        />
      );
  }
}
