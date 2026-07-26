export function LogoIcon({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="toonpilot"
      role="img"
    >
      <circle cx="20" cy="20" r="20" className="fill-primary" />
      <path
        d="M16 5 V32 C16 34 18 35 21 35 H26 M7 14 H29"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
