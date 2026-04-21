import { useGameStore } from "../../stores/useGameStore";

export function ScoreHUD() {
  const score = useGameStore((s) => s.levelScore);
  const multiplier = useGameStore((s) => s.multiplier);
  const phase = useGameStore((s) => s.phase);

  if (phase === "menu") return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
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
      {multiplier > 1 && (
        <div
          style={{
            color: "#ffdd44",
            fontSize: 16,
            marginTop: 4,
          }}
        >
          {multiplier}x MULTIPLIER
        </div>
      )}
    </div>
  );
}
