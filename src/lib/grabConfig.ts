export const GRAB_CONFIG = {
  // spawn timing -- in seconds
  MIN_SPAWN_INTERVAL: 10,
  MAX_SPAWN_INTERVAL: 20,

  // spawn position
  SPAWN_AHEAD_DISTANCE: 25, // world units ahead of train
  LATERAL_OFFSET: 4, // units from track centerline
  HEIGHT_ABOVE_GROUND: 3.5, // units above ground

  // ruby cluster appearance
  RUBY_VERTICAL_SPACING: 0.7, // units between rubies
  RUBY_SPIN_SPEED_BASE: 0.02, // base Y axis spin per frame
  RUBY_BOB_AMPLITUDE: 0.15, // bob height in units
  RUBY_BOB_SPEED: 1.5, // bob cycles per second
  GROUP_SPIN_FACTOR: 0, // Z axis group spin (0 = disabled)

  // highlight feedback -- distance based
  HIGHLIGHT_DISTANCE: 2000, // units -- rubies start pulsing
  GRAB_DISTANCE: 2000, // units -- clicking registers

  // emissive pulse when in highlight range
  EMISSIVE_BASE: 0.4,
  EMISSIVE_PULSE_MIN: 0.5,
  EMISSIVE_PULSE_MAX: 1.2,
  EMISSIVE_PULSE_SPEED: 8, // cycles per second

  // shimmy when in highlight range
  SHIMMY_AMOUNT: 0.08, // scale variation +/-
  SHIMMY_SPEED: 12, // cycles per second

  // expiry
  EXPIRY_BUFFER: 3, // units behind train before ungrabbable

  // scoring
  RUBY_POINTS: 1, // points per ruby
  ALL_THREE_BONUS_TEXT: true, // show "3x" floating text

  // crosshair
  CROSSHAIR_SIZE: 80,
  CROSSHAIR_COLOR_DEFAULT: "rgba(200, 200, 200, 0.6)",
  CROSSHAIR_COLOR_ACTIVE: "rgba(100, 255, 100, 0.8)",

  // floating bonus text
  FLOAT_DURATION_MS: 500,
  FLOAT_RISE_PX: 40,

  SPARKLE_COUNT: 50, // was 20 -- more particles
  SPARKLE_SIZE: 8, // was 0.5 -- much larger particles
  SPARKLE_SPEED: 0.5, // was 0.3 -- faster movement
  SPARKLE_COLOR: "#ffdd44", //  yellow-gold

  // mailbag
  MAILBAG_HEIGHT_ABOVE_GROUND: 0,
  MAILBAG_MIN_SPAWN_INTERVAL: 12,
  MAILBAG_MAX_SPAWN_INTERVAL: 25,
  MAILBAG_LATERAL_OFFSET: 4,
  MAILBAG_POINTS: 1,
  DELIVERED_TEXT_DURATION_MS: 1000,

  // signals
  SIGNAL_GRAB_DISTANCE: 25, // larger than rubies -- stationary target
  SIGNAL_LATERAL_OFFSET: 4, // units from track center
  SIGNAL_PULSE_SPEED: 4.0, // pulses per second when red
  SIGNAL_PENALTY_POINTS: 1, // points deducted for running red
  SIGNAL_PENALTY_DURATION: 1500, // ms for penalty text
  SIGNAL_GREEN_THRESHOLD: 20, // units -- crosshair activates
} as const;
