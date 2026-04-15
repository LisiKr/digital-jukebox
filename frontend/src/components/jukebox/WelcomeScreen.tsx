import { motion } from "framer-motion";
import { Music, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeScreenProps {
  onHost: () => void;
  onJoin: () => void;
}

export function WelcomeScreen({ onHost, onJoin }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 bg-noise">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-4 mb-16"
      >
        <div className="relative">
          <div className="h-20 w-20 rounded-2xl bg-gradient-neon flex items-center justify-center glow-neon">
            <Music className="h-10 w-10 text-neon-foreground" />
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-2xl bg-gradient-neon blur-xl -z-10"
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-glow-neon text-foreground">
          Digital Jukebox
        </h1>
        <p className="text-muted-foreground text-base">
          Your party. Your playlist. Your rules.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <Button
          variant="neon"
          size="xl"
          className="w-full rounded-2xl"
          onClick={onHost}
        >
          <Radio className="h-6 w-6" />
          Host a Room
        </Button>
        <Button
          variant="accent"
          size="xl"
          className="w-full rounded-2xl"
          onClick={onJoin}
        >
          <Music className="h-6 w-6" />
          Join a Room
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-12 text-xs text-muted-foreground"
      >
        No account needed. Just vibes.
      </motion.p>
    </div>
  );
}
