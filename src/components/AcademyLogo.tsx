import { ACADEMY_NAME } from '../lib/academy';

export function AcademyLogo({ darkSurface = false }: { darkSurface?: boolean }) {
  return (
    <img
      className={`block h-auto w-full ${darkSurface ? '' : 'rounded-md bg-obsidian px-2 py-1.5'}`}
      src="/assets/brand/srusti-academy-logo.png"
      width="4076"
      height="634"
      alt={ACADEMY_NAME}
    />
  );
}
