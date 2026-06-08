import { useState } from 'react';

const DEFAULT_LABELS: Record<number, string> = {
  1: 'No knowledge',
  2: 'Awareness',
  3: 'Basic',
  4: 'SQEP',
  5: 'Expert',
};

interface Props {
  value: number;
  onChange?: (n: number) => void;
  labels?: Record<number, string>;
  readOnly?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function StarRating({
  value,
  onChange,
  labels = DEFAULT_LABELS,
  readOnly = false,
  showLabel = true,
  size = 'sm',
}: Props) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className={`star-rate star-rate-${size}`} onMouseLeave={() => setHover(0)}>
      <span className="star-rate-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`star-btn${n <= shown ? ' on' : ''}`}
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)}
            onFocus={() => !readOnly && setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => !readOnly && onChange?.(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}${labels[n] ? `: ${labels[n]}` : ''}`}
            title={labels[n] ?? ''}
          >
            ★
          </button>
        ))}
      </span>
      {showLabel && <span className="star-rate-label">{labels[shown] ?? ''}</span>}
    </span>
  );
}
