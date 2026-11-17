// The roulette wheel in motion. Ported from ClassroomCasino's js/roulette.js. The winner is decided before the spin;
// the ball's path is scripted so it rolls, drops, rattles and settles in that pocket while the rotor keeps turning.
// Layers: a CSS-tilted plane with the static bowl and the rotating head, and an untilted canvas for the ball.
import { landingAngle, type Pocket } from '../core/rouletteGeometry';
import { paintBall, paintBowl, paintHead, RAD, WHEEL_FILL } from './rouletteArt';

const TAU = Math.PI * 2;
const TILT = (30 * Math.PI) / 180;
const mod = (a: number, n: number): number => ((a % n) + n) % n;
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

export type RouletteEvent = { kind: 'roll'; seconds: number } | { kind: 'clack'; intensity: number };

export interface RouletteElements {
  box: HTMLElement;
  plane: HTMLElement;
  bowl: HTMLCanvasElement;
  head: HTMLCanvasElement;
  ball: HTMLCanvasElement;
}

type Ball = { mode: 'pocket'; psi: number; h: number } | { mode: 'free'; abs: number; r: number; h: number };

interface Spin {
  t0: number;
  T: number;
  tSettle: number;
  psiLand: number;
  K: number;
  w: number;
  index: number;
  r0: number;
  omega0: number;
  omegaPush: number;
  diamond: boolean;
  bounces: number;
  settledAt: number;
  resolve: () => void;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = canvas.getContext('2d');
  if (!c) throw new Error('canvas 2d is not available');
  return c;
}

export class RouletteRenderer {
  private readonly bowl: CanvasRenderingContext2D;
  private readonly head: CanvasRenderingContext2D;
  private readonly ballCtx: CanvasRenderingContext2D;
  private readonly reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private readonly idle = this.reduced ? 0 : TAU / 40;
  private readonly observer: ResizeObserver;
  private pockets: readonly Pocket[] = [];
  private highlight = -1;
  private angle = 0;
  private omega = this.idle;
  private ball: Ball = { mode: 'pocket', psi: Math.PI / 37, h: 0 };
  private spin: Spin | null = null;
  private raf = 0;
  private running = false;
  private size = 0;
  private dpr = 1;
  private persp = 1;
  private cx = 0;
  private cy = 0;
  private ballWidth = 0;
  private ballHeight = 0;

  constructor(
    private readonly el: RouletteElements,
    private readonly onEvent: (event: RouletteEvent) => void,
  ) {
    this.bowl = context(el.bowl);
    this.head = context(el.head);
    this.ballCtx = context(el.ball);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(el.box);
    this.resize();
    void document.fonts?.ready.then(() => this.paintHead());
    this.start();
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.spin?.resolve();
    this.spin = null;
  }

  setPockets(pockets: readonly Pocket[]): void {
    this.pockets = pockets;
    this.highlight = -1;
    this.paintHead();
  }

  /** Launches the ball so it lands in the pocket with this id; resolves once it has settled. */
  spinTo(id: string, durationMs: number): Promise<void> {
    const index = this.pockets.findIndex((p) => p.id === id);
    if (index < 0 || this.spin) return Promise.resolve();
    this.highlight = -1;
    this.paintHead();
    const count = this.pockets.length;
    const T = this.reduced ? 2.5 : Math.max(4, durationMs / 1000);
    const tSettle = 0.8 * T;
    const psiLand = landingAngle(index, count, Math.random() - 0.5);
    const abs0 = this.ballAbs();
    const K0 = TAU * (this.reduced ? 1 : 3.5 + T * 0.4);
    const K = K0 + mod(abs0 - this.angle - psiLand - K0, TAU);
    this.onEvent({ kind: 'roll', seconds: 0.55 * tSettle });
    return new Promise((resolve) => {
      this.spin = {
        t0: performance.now(),
        T,
        tSettle,
        psiLand,
        K,
        w: TAU / count,
        index,
        r0: this.ballR(),
        omega0: this.omega,
        omegaPush: this.reduced ? 0.6 : 2.3,
        diamond: false,
        bounces: 0,
        settledAt: 0,
        resolve,
      };
    });
  }

  private start(): void {
    this.running = true;
    let last = performance.now();
    const step = (now: number): void => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.tick(now, dt);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private tick(now: number, dt: number): void {
    if (this.spin) {
      this.stepSpin(this.spin, now, dt);
    } else {
      this.omega += (this.idle - this.omega) * (1 - Math.exp(-dt / 2.5));
      this.angle = mod(this.angle + this.omega * dt, TAU);
    }
    this.el.head.style.transform = `rotate(${this.angle}rad)`;
    this.paintBall();
  }

  private ballAbs(): number {
    return this.ball.mode === 'pocket' ? this.angle + this.ball.psi : this.ball.abs;
  }

  private ballR(): number {
    return this.ball.mode === 'pocket' ? RAD.pocketBall : this.ball.r;
  }

  private project(x: number, y: number, h: number): { x: number; y: number; s: number } {
    const yr = y * Math.cos(TILT) - h * Math.sin(TILT);
    const zr = y * Math.sin(TILT) + h * Math.cos(TILT);
    const s = this.persp / (this.persp - zr);
    return { x: x * s, y: yr * s, s };
  }

  private resize(): void {
    const { box, plane, bowl, head, ball } = this.el;
    const W = Math.round(Math.min(box.clientWidth, box.clientHeight / 0.9));
    if (!W) return;
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.size = W;
    this.persp = W * 2.4;
    for (const canvas of [bowl, head]) {
      canvas.width = W * this.dpr;
      canvas.height = W * this.dpr;
    }
    const R = W / 2;
    const shift = -(this.project(0, -R, 0).y + this.project(0, R, 0).y) / 2;
    plane.style.width = `${W}px`;
    plane.style.height = `${W}px`;
    plane.style.left = `${box.clientWidth / 2 - R}px`;
    plane.style.top = `${box.clientHeight / 2 - R + shift}px`;
    plane.style.transform = `perspective(${this.persp}px) rotateX(${TILT}rad)`;
    const boxRect = box.getBoundingClientRect();
    const ballRect = ball.getBoundingClientRect();
    this.ballWidth = ballRect.width;
    this.ballHeight = ballRect.height;
    ball.width = Math.round(ballRect.width * this.dpr);
    ball.height = Math.round(ballRect.height * this.dpr);
    this.cx = boxRect.left - ballRect.left + boxRect.width / 2;
    this.cy = boxRect.top - ballRect.top + boxRect.height / 2 + shift;
    paintBowl(this.bowl, W, this.dpr);
    this.paintHead();
    this.paintBall();
  }

  private paintHead(): void {
    if (this.size && this.pockets.length) paintHead(this.head, this.size, this.dpr, this.pockets, this.highlight);
  }

  private paintBall(): void {
    if (!this.size || !this.ballWidth) return;
    paintBall(this.ballCtx, this.dpr, {
      width: this.ballWidth,
      height: this.ballHeight,
      cx: this.cx,
      cy: this.cy,
      R: (this.size / 2) * WHEEL_FILL,
      abs: this.ballAbs(),
      r: this.ballR(),
      h: this.ball.h,
      project: (x, y, h) => this.project(x, y, h),
      tiltCos: Math.cos(TILT),
    });
  }

  private stepSpin(S: Spin, now: number, dt: number): void {
    const t = (now - S.t0) / 1000;
    const R = (this.size / 2) * WHEEL_FILL;

    // The croupier gives the rotor a push, then it slowly runs down.
    this.omega =
      t < 0.6
        ? S.omega0 + (S.omegaPush - S.omega0) * easeOutCubic(t / 0.6)
        : this.idle + (S.omegaPush - this.idle) * Math.exp(-(t - 0.6) / 9);
    this.angle = mod(this.angle + this.omega * dt, TAU);

    if (t < S.tSettle) {
      const u = t / S.tSettle;
      let psi = S.psiLand + S.K * (1 - u) ** 2.6;
      let r: number;
      let h = 0;
      if (u < 0.55) {
        r = RAD.track + 0.0025 * Math.sin(t * 9);
        if (t < 0.35) {
          // Picked out of the pocket and launched onto the track.
          r = S.r0 + (RAD.track - S.r0) * easeOutCubic(t / 0.35);
          h = R * 0.06 * Math.sin((Math.PI * t) / 0.35);
        }
      } else if (u < 0.72) {
        const s = (u - 0.55) / 0.17;
        r = RAD.track - (RAD.track - RAD.pocketBall) * s * s;
        if (s > 0.35 && s < 0.55) h = R * 0.05 * Math.sin((Math.PI * (s - 0.35)) / 0.2);
        if (!S.diamond && s >= 0.35) {
          S.diamond = true;
          this.onEvent({ kind: 'clack', intensity: 0.8 });
        }
      } else {
        const v = (u - 0.72) / 0.28;
        const bounce = Math.abs(Math.sin(3 * Math.PI * v)) * (1 - v) ** 1.4;
        h = R * 0.065 * bounce;
        r = RAD.pocketBall + 0.045 * bounce;
        psi += S.w * 1.2 * Math.sin(3 * Math.PI * v) * (1 - v) ** 2;
        const k = Math.floor(v * 3);
        if (k < 3 && S.bounces <= k) {
          S.bounces = k + 1;
          this.onEvent({ kind: 'clack', intensity: 1 - k * 0.25 });
        }
      }
      this.ball = { mode: 'free', abs: this.angle + psi, r, h };
      return;
    }

    if (!S.settledAt) {
      S.settledAt = now;
      this.onEvent({ kind: 'clack', intensity: 0.35 });
      this.highlight = S.index;
      this.paintHead();
    }
    const s = (now - S.settledAt) / 1000;
    this.ball = { mode: 'pocket', psi: S.psiLand, h: R * 0.008 * Math.exp(-6 * s) * Math.abs(Math.sin(25 * s)) };
    if (s > 0.7) {
      this.spin = null;
      this.ball = { mode: 'pocket', psi: S.psiLand, h: 0 };
      S.resolve();
    }
  }
}
