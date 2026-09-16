import clsx from "clsx";

type Mood = "idle" | "yay" | "sad" | "wave";

export function ToyMascot({
  mood = "idle",
  className,
}: {
  mood?: Mood;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 220"
      className={clsx("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="blob" x1="40" y1="20" x2="180" y2="200">
          <stop offset="0%" stopColor="#C4B5FF" />
          <stop offset="100%" stopColor="#8B7CFF" />
        </linearGradient>
      </defs>
      <ellipse
        cx="110"
        cy="200"
        rx="46"
        ry="8"
        fill="#1B1828"
        opacity="0.12"
      />
      <g className={mood === "yay" ? "origin-center animate-wiggle" : undefined}>
        <path
          d="M48 118c8-52 40-78 62-78s54 26 62 78c6 38-16 72-62 72s-68-34-62-72z"
          fill="url(#blob)"
        />
        <ellipse cx="110" cy="148" rx="38" ry="22" fill="#E8FF7A" />
        <circle cx="86" cy="108" r="16" fill="#FFFDF7" />
        <circle cx="134" cy="108" r="16" fill="#FFFDF7" />
        <circle
          cx="90"
          cy="110"
          r="7"
          fill="#17151F"
          className={mood === "yay" ? "origin-center animate-softpulse" : undefined}
        />
        <circle cx="138" cy="110" r="7" fill="#17151F" />
        <circle cx="94" cy="107" r="2.4" fill="white" />
        <circle cx="142" cy="107" r="2.4" fill="white" />
        {mood === "sad" ? (
          <path
            d="M96 142c8 6 20 6 28 0"
            fill="none"
            stroke="#17151F"
            strokeWidth="4"
            strokeLinecap="round"
            transform="scale(1,-1) translate(0,-284)"
          />
        ) : (
          <path
            d="M96 140c8 10 20 10 28 0"
            fill="none"
            stroke="#17151F"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
        <path
          d={
            mood === "yay"
              ? "M52 92c-22-28-28-8-18 10"
              : mood === "wave"
                ? "M48 78c-8-32 18-38 22-12"
                : "M46 108c-18-8-22 18-6 22"
          }
          fill="none"
          stroke="#17151F"
          strokeWidth="7"
          strokeLinecap="round"
          className={mood === "wave" ? "origin-[48px_90px] animate-wave" : undefined}
        />
        <path
          d={
            mood === "yay"
              ? "M168 92c22-28 28-8 18 10"
              : "M174 108c18-8 22 18 6 22"
          }
          fill="none"
          stroke="#17151F"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="168" cy="58" r="7" fill="#FF6D57" className="animate-pop" />
        <path
          d="M168 46v-8M160 50l-6-6M176 50l6-6"
          stroke="#FF6D57"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
