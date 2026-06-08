interface Props {
  steps: string[];
  current: number; // index of the active step
}

// Deterministic spread of particles so the flow looks organic without randomness on each render.
const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  lane: [4, 8, 12][i % 3],
  duration: 2.2 + (i % 5) * 0.6,
  delay: (i * 0.37) % 3,
  size: 3 + (i % 3),
}));

export default function NuclearisationProcess({ steps, current }: Props) {
  const n = steps.length;
  const pct = n > 1 ? Math.max(0, Math.min(current, n - 1)) / (n - 1) * 100 : 0;
  const complete = current >= n - 1;
  const stageLabel = steps[Math.max(0, Math.min(current, n - 1))] ?? '';

  return (
    <div className={`nuke${complete ? ' nuke-complete' : ''}`}>
      <div className="nuke-head">
        <span className="nuke-title"><i className="nuke-orb" />Nuclearisation</span>
        <span className="nuke-stage">{Math.round(pct)}% · {stageLabel}</span>
      </div>

      <div className="nuke-track-wrap">
        <div className="nuke-track" />
        <div className="nuke-fill" style={{ width: `${pct}%` }}>
          {pct > 0 && PARTICLES.map((p, i) => (
            <span
              key={i}
              className="nuke-particle"
              style={{
                top: `${p.lane}px`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="nuke-nodes">
          {steps.map((s, idx) => {
            const state = idx < current ? 'done' : idx === current ? 'active' : 'todo';
            return (
              <div
                key={s}
                className={`nuke-node ${state}`}
                style={{ left: `${n > 1 ? (idx / (n - 1)) * 100 : 0}%` }}
              >
                <span className="nuke-dot">{idx < current ? '✓' : idx + 1}</span>
                <span className="nuke-label">{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
