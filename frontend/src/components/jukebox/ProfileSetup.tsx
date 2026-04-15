import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Dices, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const funnyNames = [
  "DJ DropTheBass", "Sir Skips-a-Lot", "MC Buffering", "Lil' Queue",
  "Beat Destroyer", "DJ 404", "The Vibe Whisperer", "Bass Cadet",
  "Tempo Tantrum", "DJ Lag Spike", "Rhythm Bandit", "Sir Mix-a-Queue",
  "The Track Surgeon", "Veto Queen", "DJ Decibel", "Sonic Boom Jr.",
];

interface ProfileSetupProps {
  onEnter: (name: string) => void;
  onBack: () => void;
  error?: string;
  loading?: boolean;
}

export function ProfileSetup({ onEnter, onBack, error, loading }: ProfileSetupProps) {
  const [name, setName] = useState("");

  const randomize = () => {
    const n = funnyNames[Math.floor(Math.random() * funnyNames.length)];
    setName(n);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 pt-4 pb-8 bg-noise">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground mb-6 active:scale-95 transition-transform self-start">
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Back</span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col flex-1 justify-center max-w-sm mx-auto w-full"
      >
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-foreground">What's your DJ name?</h2>
          <p className="text-sm text-muted-foreground mt-1">This is how others will see you in the room</p>
        </div>

        <div className="flex gap-2 mb-6">
          <Input
            type="text"
            placeholder="Enter your DJ Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="flex-1 h-14 rounded-xl bg-surface border-border text-lg font-medium"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-xl shrink-0 border-border"
            onClick={randomize}
            title="Randomize"
          >
            <Dices className="h-6 w-6" />
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}

        <Button
          variant="neon"
          size="xl"
          className="w-full rounded-2xl"
          disabled={!name.trim() || loading}
          onClick={() => onEnter(name.trim())}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Enter Party 🎉"
          )}
        </Button>
      </motion.div>
    </div>
  );
}
