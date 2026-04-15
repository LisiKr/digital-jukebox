import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface JoinFlowProps {
  onNext: (code: string) => void;
  onBack: () => void;
}

export function JoinFlow({ onNext, onBack }: JoinFlowProps) {
  const [code, setCode] = useState("");

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 pt-4 pb-8 bg-noise">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground mb-6 active:scale-95 transition-transform self-start">
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Back</span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 flex-1"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">Join a Room</h2>
          <p className="text-sm text-muted-foreground mt-1">Scan a QR code or enter the room code</p>
        </div>

        <div className="aspect-square w-full max-w-xs mx-auto rounded-2xl bg-surface-elevated border-2 border-dashed border-border flex flex-col items-center justify-center gap-3">
          <div className="h-16 w-16 rounded-full bg-neon-muted flex items-center justify-center">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Camera preview</p>
          <p className="text-xs text-muted-foreground/60">Point at QR code to join</p>
        </div>

        <div className="flex items-center gap-4 max-w-xs mx-auto w-full">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="max-w-xs mx-auto w-full flex flex-col gap-3">
          <Input
            type="text"
            maxLength={6}
            placeholder="Room Code"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .replace(/[^A-Fa-f0-9]/g, "")
                  .toUpperCase()
                  .slice(0, 6),
              )
            }
            className="text-center text-3xl font-bold tracking-[0.5em] h-16 rounded-xl bg-surface border-border placeholder:text-lg placeholder:tracking-normal placeholder:font-normal"
          />
          <Button
            variant="neon"
            size="lg"
            className="w-full rounded-xl"
            disabled={code.length < 6}
            onClick={() => onNext(code)}
          >
            Next
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
