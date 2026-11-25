import { ACADEMY_NAME } from '../lib/academy';

export function AcademyLogo({ darkSurface = false }: { darkSurface?: boolean }) {
  return (
    <span className={darkSurface ? 'academy-logo academy-logo-dark' : 'academy-logo'}>
      <img
        className="academy-crest"
        src="/assets/brand/srusti-academy-crest.png"
        width="281"
        height="294"
        alt=""
      />
      <span className="academy-wordmark">
        <img src="/assets/brand/srusti-academy-navbar.png" width="1007" height="248" alt="" />
      </span>
      <span className="sr-only">{ACADEMY_NAME}</span>
    </span>
  );
}
