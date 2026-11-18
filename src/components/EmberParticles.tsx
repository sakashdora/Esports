import { useEffect, useRef } from 'react';

interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  spriteIdx: number;
  swayFreq: number;
  swayAmp: number;
  phase: number;
}

interface EmberParticlesProps {
  density?: number;
  className?: string;
}

const EMBER_PALETTE = [
  'rgba(35, 61, 139,', // college blue
  'rgba(212, 27, 20,',  // SAMT crimson spark
  'rgba(229, 199, 54,', // championship gold
  'rgba(192, 192, 192,', // metallic silver
];

function buildEmberSprites(): HTMLCanvasElement[] {
  const size = 32;
  const half = size / 2;
  return EMBER_PALETTE.map((colorPrefix) => {
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const sCtx = sprite.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0, 'rgba(255, 244, 214, 0.95)');
      grad.addColorStop(0.22, `${colorPrefix} 0.85)`);
      grad.addColorStop(0.55, `${colorPrefix} 0.28)`);
      grad.addColorStop(1, `${colorPrefix} 0)`);
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, size, size);
    }
    return sprite;
  });
}

function createEmber(width: number, height: number, spawnAtBottom = false): EmberParticle {
  const maxLife = 4.5 + Math.random() * 5.5;
  const maxAlpha = 0.24 + Math.random() * 0.48;
  return {
    x: Math.random() * width,
    y: spawnAtBottom ? height + Math.random() * 32 : Math.random() * height,
    vx: (Math.random() - 0.5) * 14,
    vy: -(20 + Math.random() * 40),
    radius: 1.1 + Math.random() * 2.1,
    alpha: spawnAtBottom ? 0 : Math.random() * maxAlpha,
    maxAlpha,
    life: spawnAtBottom ? 0 : Math.random() * maxLife,
    maxLife,
    spriteIdx: Math.floor(Math.random() * EMBER_PALETTE.length),
    swayFreq: 0.7 + Math.random() * 1.4,
    swayAmp: 7 + Math.random() * 13,
    phase: Math.random() * Math.PI * 2,
  };
}

export function EmberParticles({ density = 44, className = '' }: EmberParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sprites = buildEmberSprites();
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let width = 0;
    let height = 0;
    let particles: EmberParticle[] = [];
    let rafId = 0;
    let lastTime = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const targetCount = width < 640 ? Math.max(8, Math.floor(density * 0.5)) : density;
      if (particles.length === 0) {
        particles = Array.from({ length: targetCount }, () => createEmber(width, height, false));
      } else if (particles.length !== targetCount) {
        while (particles.length < targetCount) {
          particles.push(createEmber(width, height, false));
        }
        if (particles.length > targetCount) {
          particles.length = targetCount;
        }
      }
      if (motionQuery.matches) drawFrame(0, false);
    };

    const drawFrame = (dt: number, animate: boolean) => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (animate) {
          p.life += dt;
          if (p.life >= p.maxLife || p.y < -20) {
            particles[i] = createEmber(width, height, true);
            continue;
          }
          const progress = p.life / p.maxLife;
          const fadeIn = Math.min(1, progress * 5);
          const fadeOut = Math.max(0, 1 - Math.pow(progress, 2.2));
          p.alpha = p.maxAlpha * fadeIn * fadeOut;
          const sway = Math.sin(p.life * p.swayFreq + p.phase) * p.swayAmp;
          p.x += (p.vx + sway) * dt;
          p.y += p.vy * dt;
        }

        if (p.alpha <= 0.015) continue;

        const drawSize = p.radius * 7.2;
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(
          sprites[p.spriteIdx],
          p.x - drawSize / 2,
          p.y - drawSize / 2,
          drawSize,
          drawSize
        );
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener('resize', resize);

    const tick = (now: number) => {
      rafId = 0;
      if (document.hidden || !visible || motionQuery.matches) return;
      if (now - lastTime >= 1000 / 30) {
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        drawFrame(dt, true);
      }
      rafId = window.requestAnimationFrame(tick);
    };
    const syncAnimation = () => {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
      if (motionQuery.matches) { drawFrame(0, false); return; }
      if (!document.hidden && visible) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      syncAnimation();
    }) : null;
    observer?.observe(canvas);
    document.addEventListener('visibilitychange', syncAnimation);
    motionQuery.addEventListener('change', syncAnimation);
    syncAnimation();
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', syncAnimation);
      motionQuery.removeEventListener('change', syncAnimation);
      observer?.disconnect();
      ro?.disconnect();
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
