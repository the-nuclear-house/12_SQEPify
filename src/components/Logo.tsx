/**
 * The Nuclear House mark: a house outline (open at the base) enclosing an atom.
 * Drawn with currentColor so the caller controls the colour. On dark backgrounds
 * set the colour to white, per brand guidance.
 */
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="The Nuclear House"
    >
      {/* House outline with a doorway gap at the base */}
      <path
        d="M60 87 L87 87 L87 37 L50 7 L13 37 L13 87 L40 87"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Atom orbits */}
      <g stroke="currentColor" strokeWidth="3" fill="none">
        <ellipse cx="50" cy="50" rx="26" ry="10" />
        <ellipse cx="50" cy="50" rx="26" ry="10" transform="rotate(60 50 50)" />
        <ellipse cx="50" cy="50" rx="26" ry="10" transform="rotate(120 50 50)" />
      </g>
      {/* Nucleus */}
      <circle cx="50" cy="50" r="6" fill="currentColor" />
    </svg>
  );
}
