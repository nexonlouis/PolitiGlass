import Image from "next/image";
import Link from "next/link";

const SIZES = {
  sm: 32,
  md: 40,
  lg: 72,
} as const;

type AppLogoSize = keyof typeof SIZES;

interface AppLogoProps {
  size?: AppLogoSize;
  showWordmark?: boolean;
  href?: string | null;
  className?: string;
}

export function AppLogo({
  size = "sm",
  showWordmark = true,
  href = "/",
  className = "",
}: AppLogoProps) {
  const px = SIZES[size];

  const inner = (
  <>
    <Image
      src="/logo.jpg"
      alt=""
      width={px}
      height={px}
      className="shrink-0 rounded-full"
      priority={size === "lg"}
    />
    {showWordmark && (
      <span className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        CivicMirror
      </span>
    )}
  </>
  );

  const classes = `inline-flex items-center gap-2.5 ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  return <div className={classes}>{inner}</div>;
}
