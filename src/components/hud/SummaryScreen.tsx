import { useGameStore } from "../../stores/useGameStore";
import { getLevelConfig } from "../../lib/levelConfig";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid rgba(196, 121, 26, 0.2)",
      }}
    >
      <span
        style={{
          fontFamily: "Playfair Display, serif",
          fontSize: 15,
          color: "#f5e6c8",
          opacity: 0.85,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 16,
          color: "#c4791a",
          fontWeight: "bold",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function SummaryScreen() {
  const phase = useGameStore((s) => s.phase);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const sessionScore = useGameStore((s) => s.sessionScore);
  const levelScore = useGameStore((s) => s.levelScore);
  const levelRubies = useGameStore((s) => s.levelRubies);
  const levelMailbags = useGameStore((s) => s.levelMailbags);
  const levelSignals = useGameStore((s) => s.levelSignals);
  const totalRubies = useGameStore((s) => s.totalRubies);
  const totalMailbags = useGameStore((s) => s.totalMailbags);
  const totalSignals = useGameStore((s) => s.totalSignals);
  const startNextLevel = useGameStore((s) => s.startNextLevel);

  if (phase !== "summary") return null;

  const config = getLevelConfig(currentLevel);
  const isLastLevel = currentLevel >= 4;
  const nextLabel = isLastLevel ? "Start Over" : "Next Level";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backgroundColor: "rgba(20, 8, 4, 0.92)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(180deg, #3d1200 0%, #1a0800 60%, #0d0400 100%)",
          border: "3px solid #c4791a",
          borderRadius: "4px",
          padding: "40px 50px",
          maxWidth: "480px",
          width: "90%",
          textAlign: "center",
          boxShadow:
            "0 0 40px rgba(139, 37, 0, 0.6), inset 0 0 60px rgba(0,0,0,0.4)",
          position: "relative",
        }}
      >
        {/* corner decorations */}
        {["topLeft", "topRight", "bottomLeft", "bottomRight"].map((corner) => (
          <div
            key={corner}
            style={{
              position: "absolute",
              width: "20px",
              height: "20px",
              border: "2px solid #c4791a",
              borderRadius: "2px",
              ...(corner === "topLeft" && {
                top: 8,
                left: 8,
                borderRight: "none",
                borderBottom: "none",
              }),
              ...(corner === "topRight" && {
                top: 8,
                right: 8,
                borderLeft: "none",
                borderBottom: "none",
              }),
              ...(corner === "bottomLeft" && {
                bottom: 8,
                left: 8,
                borderRight: "none",
                borderTop: "none",
              }),
              ...(corner === "bottomRight" && {
                bottom: 8,
                right: 8,
                borderLeft: "none",
                borderTop: "none",
              }),
            }}
          />
        ))}

        {/* header */}
        <div
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 11,
            color: "#c4791a",
            letterSpacing: "4px",
            marginBottom: "6px",
            opacity: 0.8,
          }}
        >
          ✦ WESTERN PACIFIC RAILROAD ✦
        </div>

        <div
          style={{
            fontFamily: "Rye, serif",
            fontSize: "13px",
            color: "#c4791a",
            letterSpacing: "3px",
            marginBottom: "4px",
          }}
        >
          LEVEL {currentLevel} COMPLETE
        </div>

        <div
          style={{
            fontFamily: "Rye, serif",
            fontSize: "26px",
            color: "#f5e6c8",
            textShadow: "2px 2px 8px rgba(0,0,0,0.8)",
            marginBottom: "4px",
          }}
        >
          {config.label}
        </div>

        {/* divider */}
        <div
          style={{
            borderTop: "1px solid rgba(196, 121, 26, 0.5)",
            margin: "20px 0 16px",
          }}
        />

        {/* stats */}
        <div style={{ marginBottom: "8px" }}>
          <StatRow label="Level Score" value={levelScore.toLocaleString()} />
          <StatRow
            label="Session Score"
            value={sessionScore.toLocaleString()}
          />
          <StatRow
            label="Rubies Collected"
            value={`${levelRubies} / ${totalRubies}`}
          />
          <StatRow
            label="Mailbags Delivered"
            value={`${levelMailbags} / ${totalMailbags}`}
          />
          <StatRow
            label="Signals Cleared"
            value={`${levelSignals} / ${totalSignals}`}
          />
        </div>

        {/* divider */}
        <div
          style={{
            borderTop: "1px solid rgba(196, 121, 26, 0.5)",
            margin: "20px 0 24px",
          }}
        />

        {/* next button */}
        <button
          onClick={startNextLevel}
          style={{
            fontFamily: "Rye, serif",
            fontSize: "18px",
            color: "#f5e6c8",
            background: "linear-gradient(180deg, #8b2500 0%, #5a1500 100%)",
            border: "2px solid #c4791a",
            borderRadius: "3px",
            padding: "14px 48px",
            cursor: "pointer",
            letterSpacing: "3px",
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.background =
              "linear-gradient(180deg, #a83000 0%, #6b1a00 100%)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.background =
              "linear-gradient(180deg, #8b2500 0%, #5a1500 100%)";
          }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
