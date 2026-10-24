export default function Flag({ size = 30, rounded = true }) {
  return (
    <svg
      width={size}
      height={(size * 2) / 3}
      viewBox="0 0 300 200"
      aria-label="Sainan'i Madagasikara"
      className={rounded ? 'flag-logo' : undefined}
    >
      <rect width="150" height="200" fill="#ffffff" />
      <rect x="150" width="150" height="100" fill="#fc3d32" />
      <rect x="150" y="100" width="150" height="100" fill="#007e3a" />
    </svg>
  );
}
