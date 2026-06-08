function Stars({ n, tone }: { n: number; tone: 'have' | 'gain' }) {
  return (
    <span className={`stars ${tone}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? 'star on' : 'star off'}>{i <= n ? '★' : '☆'}</span>
      ))}
    </span>
  );
}

export default function StarBand({ from, to }: { from: number; to: number }) {
  return (
    <span className="starband" title={`Level ${from} to ${to}`}>
      <Stars n={from} tone="have" />
      <span className="band-arrow">→</span>
      <Stars n={to} tone="gain" />
    </span>
  );
}
