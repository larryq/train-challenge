import { useEffect, useRef } from "react";
import { useGameStore } from "../../stores/useGameStore";

export function GameTimer() {
  const phase = useGameStore((s) => s.phase);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const tickTimer = useGameStore((s) => s.tickTimer);
  const endLevel = useGameStore((s) => s.endLevel);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // tick every second while playing
  useEffect(() => {
    if (phase !== "playing") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phase, tickTimer]);

  // end level when timer hits zero
  useEffect(() => {
    if (timeRemaining <= 0 && phase === "playing") {
      endLevel();
    }
  }, [timeRemaining, phase, endLevel]);

  return null;
}
