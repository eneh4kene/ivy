/**
 * Logo — the Ivy app icon mark, used in header lockups across auth/onboarding
 * screens and the sidebar. Renders the real brand logo (public/icons) instead
 * of the old generic Leaf glyph. Pair it with the "Ivy" wordmark where the
 * existing layouts already have one.
 */

interface LogoProps {
  /** Pixel size of the square mark. Defaults to 40 (matches the old w-10 box). */
  size?: number
  className?: string
}

export function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/icon-192x192.png"
      alt="Ivy"
      width={size}
      height={size}
      className={`rounded-xl shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
