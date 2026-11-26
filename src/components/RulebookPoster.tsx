import type { CampusEvent } from '../lib/defaultEvents';

export const rulebookPosters: Partial<Record<string, { src: string; width: number; height: number }>> = {
  'kalinga-warriors-bgmi': { src: '/assets/brand/kalinga-guide.png', width: 1122, height: 1402 },
  'kurukshetra-free-fire': { src: '/assets/brand/kurukshetra-guide.png?v=2', width: 2240, height: 2434 },
};

export function RulebookPoster({ event, loading = 'eager', className }: {
  event: CampusEvent;
  loading?: 'eager' | 'lazy';
  className?: string;
}) {
  const poster = rulebookPosters[event.slug];
  if (!poster) return null;
  return (
    <figure className={className}>
      <a className="block cursor-zoom-in" href={poster.src} aria-label={`Open full-size ${event.gameTitle} tournament poster`}>
        <img className="block h-auto w-full" src={poster.src} width={poster.width} height={poster.height} loading={loading}
          alt={`${event.title} tournament poster showing gameplay rules, fixtures, qualification flowchart, placement points and prizes`} />
      </a>
    </figure>
  );
}
