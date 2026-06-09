export default function AaveIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <defs>
        <linearGradient id="aave-icon-grad" x1="0" y1="0" x2="20" y2="20">
          <stop offset="0%" stopColor="#B6509E" />
          <stop offset="100%" stopColor="#2EBAC6" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="10" fill="url(#aave-icon-grad)" />
      <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">A</text>
    </svg>
  );
}
