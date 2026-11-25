import type { CampusEvent } from '../lib/defaultEvents';

export const rulebookPosters: Partial<Record<string, string>> = {
  'kalinga-warriors-bgmi': '/assets/brand/kalinga-guide.png',
  'kurukshetra-free-fire': '/assets/brand/kurukshetra-guide.png',
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
      <a className="block cursor-zoom-in" href={poster} aria-label={`Open full-size ${event.gameTitle} tournament poster`}>
        <img className="block h-auto w-full" src={poster} width="1122" height="1402" loading={loading}
          alt={`${event.title} tournament poster showing gameplay rules, fixtures, qualification flowchart, placement points and prizes`} />
      </a>
      {event.slug === 'kurukshetra-free-fire' && (
        <figcaption className="px-3 py-2 text-[13px] text-[#f1d6aa]">
          Free Fire scoring correction · 2nd place earns 9 points. 3rd place earns 8.
        </figcaption>
      )}
    </figure>
  );
}
