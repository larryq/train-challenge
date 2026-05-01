import { useState, useCallback } from "react";
import { useGameStore } from "../../stores/useGameStore";

export function IntroScreen() {
  const phase = useGameStore((s) => s.phase);
  const startGame = useGameStore((s) => s.startGame);
  const [fading, setFading] = useState(false);

  const handleStart = useCallback(() => {
    setFading(true);
    // wait for fade animation then start game
    setTimeout(() => {
      startGame();
    }, 1000);
  }, [startGame]);

  if (phase !== "menu") return null;

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
        backgroundColor: "rgba(20, 8, 4, 0.82)",
        backdropFilter: "blur(2px)",
        animation: fading ? "fadeOut 1000ms ease-out forwards" : "none",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* main panel */}
      <div
        style={{
          background:
            "linear-gradient(180deg, #3d1200 0%, #1a0800 60%, #0d0400 100%)",
          border: "3px solid #c4791a",
          borderRadius: "4px",
          padding: "40px 50px",
          maxWidth: "660px",
          width: "90%",
          textAlign: "center",
          position: "relative",
          boxShadow:
            "0 0 40px rgba(139, 37, 0, 0.6), inset 0 0 60px rgba(0,0,0,0.4)",
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

        {/* top decorative line */}
        <div
          style={{
            borderTop: "1px solid #c4791a",
            borderBottom: "1px solid #c4791a",
            padding: "4px 0",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              borderTop: "1px solid rgba(196, 121, 26, 0.4)",
              borderBottom: "1px solid rgba(196, 121, 26, 0.4)",
              padding: "2px 0",
              color: "#c4791a",
              fontSize: "10px",
              letterSpacing: "4px",
              fontFamily: "Playfair Display, serif",
            }}
          >
            ✦ WESTERN PACIFIC RAILROAD ✦
          </div>
        </div>

        {/* placeholder image area */}
        <div
          style={{
            width: "100%",
            height: "160px",
            background:
              "linear-gradient(180deg, #1a1a2e 0%, #2d1a0a 40%, #1a0800 100%)",
            border: "1px solid #c4791a",
            borderRadius: "2px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* SVG train silhouette placeholder */}
          <svg viewBox="0 0 400 160" style={{ width: "100%", height: "100%" }}>
            {/* sunset sky gradient */}
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a1a3e" />
                <stop offset="60%" stopColor="#8b2500" />
                <stop offset="100%" stopColor="#c4791a" />
              </linearGradient>
              <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2a1208" />
                <stop offset="100%" stopColor="#0d0400" />
              </linearGradient>
            </defs>

            {/* sky */}
            <rect width="400" height="120" fill="url(#sky)" />

            {/* ground */}
            <rect y="110" width="400" height="50" fill="url(#ground)" />

            {/* sun */}
            <circle cx="320" cy="80" r="22" fill="#c4791a" opacity="0.9" />
            <circle cx="320" cy="80" r="28" fill="#c4791a" opacity="0.2" />

            {/* distant hills */}
            <ellipse cx="80" cy="112" rx="80" ry="30" fill="#1a0800" />
            <ellipse cx="200" cy="115" rx="100" ry="25" fill="#220d00" />
            <ellipse cx="350" cy="110" rx="90" ry="35" fill="#1a0800" />

            {/* track rails */}
            <line
              x1="0"
              y1="130"
              x2="400"
              y2="125"
              stroke="#c4791a"
              strokeWidth="2"
              opacity="0.6"
            />
            <line
              x1="0"
              y1="138"
              x2="400"
              y2="133"
              stroke="#c4791a"
              strokeWidth="2"
              opacity="0.6"
            />

            {/* track ties */}
            {[20, 60, 100, 140, 180, 220, 260, 300, 340, 380].map((x, i) => (
              <line
                key={i}
                x1={x}
                y1="127"
                x2={x + 8}
                y2="136"
                stroke="#8b6914"
                strokeWidth="3"
                opacity="0.5"
              />
            ))}

            {/* train silhouette */}
            {/* cab */}
            <rect x="60" y="88" width="40" height="32" rx="2" fill="#0d0400" />
            {/* body */}
            <rect x="100" y="95" width="90" height="25" rx="2" fill="#0d0400" />
            {/* boiler */}
            <rect x="140" y="92" width="55" height="28" rx="4" fill="#0d0400" />
            {/* chimney */}
            <rect x="180" y="80" width="10" height="14" rx="2" fill="#0d0400" />
            <rect x="177" y="78" width="16" height="5" rx="2" fill="#0d0400" />
            {/* smoke */}
            <circle cx="185" cy="70" r="8" fill="#3a3a3a" opacity="0.5" />
            <circle cx="192" cy="62" r="10" fill="#3a3a3a" opacity="0.3" />
            <circle cx="198" cy="53" r="12" fill="#3a3a3a" opacity="0.2" />
            {/* wheels */}
            <circle
              cx="80"
              cy="124"
              r="10"
              fill="#0d0400"
              stroke="#c4791a"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <circle
              cx="110"
              cy="124"
              r="10"
              fill="#0d0400"
              stroke="#c4791a"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <circle
              cx="145"
              cy="124"
              r="12"
              fill="#0d0400"
              stroke="#c4791a"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <circle
              cx="178"
              cy="124"
              r="12"
              fill="#0d0400"
              stroke="#c4791a"
              strokeWidth="1.5"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* title */}
        <div
          style={{
            fontFamily: "Rye, serif",
            fontSize: "38px",
            color: "#c4791a",
            marginBottom: "6px",
            textShadow:
              "2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(196,121,26,0.4)",
            animation: "flicker 8s infinite",
            letterSpacing: "2px",
          }}
        >
          All Aboard!
        </div>

        {/* subtitle line */}
        <div
          style={{
            color: "#c4791a",
            fontSize: "11px",
            letterSpacing: "6px",
            fontFamily: "Playfair Display, serif",
            marginBottom: "24px",
            opacity: 0.7,
          }}
        >
          ── EST. 1887 ──
        </div>

        {/* divider */}
        <div
          style={{
            borderTop: "1px solid rgba(196, 121, 26, 0.4)",
            marginBottom: "20px",
          }}
        />

        {/* instructions */}
        <div
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "16px",
            lineHeight: "1.7",
            color: "#f5e6c8",
            marginBottom: "12px",
            textAlign: "left",
          }}
        >
          Ride the rails and enjoy the scenery, or collect mailbags and floating
          rubies along the way to add to your score.
        </div>

        <div
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "16px",
            lineHeight: "1.7",
            color: "#f5e6c8",
            marginBottom: "12px",
            textAlign: "left",
          }}
        >
          Be sure to click on flashing red signals to turn them green before
          passing, or else your score will suffer.
        </div>

        <div
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "15px",
            lineHeight: "1.7",
            color: "#f5e6c8",
            marginBottom: "28px",
            textAlign: "left",
            fontStyle: "italic",
          }}
        >
          Good luck conductor!
        </div>

        {/* divider */}
        <div
          style={{
            borderTop: "1px solid rgba(196, 121, 26, 0.4)",
            marginBottom: "28px",
          }}
        />

        {/* start button */}
        <button
          onClick={handleStart}
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
            textTransform: "uppercase",
            animation: "pulse 2s infinite",
            transition: "transform 0.1s, background 0.1s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.background =
              "linear-gradient(180deg, #a83000 0%, #6b1a00 100%)";
            (e.target as HTMLButtonElement).style.transform = "scale(1.03)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.background =
              "linear-gradient(180deg, #8b2500 0%, #5a1500 100%)";
            (e.target as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          Start Journey
        </button>

        {/* bottom decorative line */}
        <div
          style={{
            borderTop: "1px solid #c4791a",
            borderBottom: "1px solid #c4791a",
            padding: "4px 0",
            marginTop: "28px",
          }}
        >
          <div
            style={{
              borderTop: "1px solid rgba(196, 121, 26, 0.4)",
              borderBottom: "1px solid rgba(196, 121, 26, 0.4)",
              padding: "2px 0",
              color: "#c4791a",
              fontSize: "10px",
              letterSpacing: "4px",
              fontFamily: "Playfair Display, serif",
            }}
          >
            ✦ TICKETS AVAILABLE AT THE STATION ✦
          </div>
        </div>
      </div>
    </div>
  );
}
