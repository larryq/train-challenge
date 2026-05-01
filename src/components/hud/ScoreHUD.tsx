import { useGameStore } from "../../stores/useGameStore";

export function ScoreHUD() {
  const score = useGameStore((s) => s.levelScore);
  //const multiplier = useGameStore((s) => s.multiplier);
  const phase = useGameStore((s) => s.phase);

  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const currentLevel = useGameStore((s) => s.currentLevel);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const isLow = timeRemaining < 30;

  if (phase === "menu") return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 30,
        color: "white",
        fontFamily: "monospace",
        fontSize: 24,
        textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
        userSelect: "none",
        textAlign: "right",
      }}
    >
      <div>SCORE</div>
      <div style={{ fontSize: 36, fontWeight: "bold" }}>
        {score.toString().padStart(3, "0")}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "14px",
        }}
      >
        <div
          style={{
            color: "#f5e6c8",
            fontSize: 18,
            fontFamily: "Rye, serif",
            opacity: 0.7,
          }}
        >
          Level {currentLevel}
        </div>

        <div
          style={{
            color: isLow ? "#ff4444" : "#110598",
            fontSize: 36,
            fontFamily: "monospace",
            fontWeight: "bold",
            textShadow: isLow ? "0 0 10px #ff0000" : "none",
            transition: "color 0.5s, text-shadow 0.5s",
          }}
        >
          {timeStr}
        </div>
      </div>
    </div>
  );
}
