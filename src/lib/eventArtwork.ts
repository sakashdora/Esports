export const HERO_ARENA_IMAGE = '/src/assets/images/hero_fire_esports_arena_1794848520848.jpg';
export const CONTROLLER_HERO_IMAGE = '/src/assets/images/nexus_controller_hero.jpg';
export const PRIZE_POOL_TROPHY_IMAGE = '/src/assets/images/prize_pool_trophy.jpg';
export const BGMI_BANNER_IMAGE = '/src/assets/images/bgmi_erangel_keyart_1794845847605.jpg';
export const FREEFIRE_BANNER_IMAGE = '/src/assets/images/freefire_bermuda_keyart_1794845847011.jpg';
export const CAMPUS_EVENT_BANNER_IMAGE = '/src/assets/images/hero_fire_esports_arena_1794848520848.jpg';

export const BGMI_POSTER_IMAGE = '/src/assets/images/bgmi_esports_poster_1794845845748.jpg';
export const FREEFIRE_POSTER_IMAGE = '/src/assets/images/freefire_esports_poster_1794845845810.jpg';

export function getEventBannerUrl(slug: string, gameTitle: string): string {
  const s = slug.toLowerCase();
  const g = gameTitle.toLowerCase();
  if (s.includes('bgmi') || g.includes('bgmi') || g.includes('pubg')) {
    return BGMI_BANNER_IMAGE;
  }
  if (s.includes('free-fire') || g.includes('free fire')) {
    return FREEFIRE_BANNER_IMAGE;
  }
  return CAMPUS_EVENT_BANNER_IMAGE;
}

export function getEventPosterUrl(slug: string, gameTitle: string): string {
  const s = slug.toLowerCase();
  const g = gameTitle.toLowerCase();
  if (s.includes('bgmi') || g.includes('bgmi') || g.includes('pubg')) {
    return BGMI_POSTER_IMAGE;
  }
  if (s.includes('free-fire') || g.includes('free fire')) {
    return FREEFIRE_POSTER_IMAGE;
  }
  return CAMPUS_EVENT_BANNER_IMAGE;
}
