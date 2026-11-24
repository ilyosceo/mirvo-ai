declare module 'plotly.js-dist-min';
declare module 'smiles-drawer';
declare module '@rive-app/canvas';
declare module 'phaser';

declare module 'zdog' {
  export interface VectorOptions {
    x?: number;
    y?: number;
    z?: number;
  }

  export class Anchor {
    constructor(options?: Record<string, unknown>);
    rotate: { x: number; y: number; z: number };
    translate: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    addChild(child: Anchor): void;
    remove(): void;
  }

  export class Illustration extends Anchor {
    constructor(options: {
      element: HTMLCanvasElement | SVGSVGElement | string;
      zoom?: number;
      dragRotate?: boolean | Anchor;
      resize?: boolean | 'fullscreen';
      centered?: boolean;
      onDragStart?: () => void;
      onDragMove?: () => void;
      onDragEnd?: () => void;
      onResize?: (width: number, height: number) => void;
    });
    width: number;
    height: number;
    zoom: number;
    updateRenderGraph(item?: Anchor): void;
    setSize(width: number, height: number): void;
  }

  export class Group extends Anchor {
    constructor(options?: Record<string, unknown>);
  }

  export class Shape extends Anchor {
    constructor(options?: Record<string, unknown>);
  }

  export class Ellipse extends Shape {}
  export class Rect extends Shape {}
  export class RoundedRect extends Shape {}
  export class Polygon extends Shape {}
  export class Hemisphere extends Shape {}
  export class Cone extends Shape {}
  export class Cylinder extends Shape {}
  export class Box extends Anchor {
    constructor(options?: Record<string, unknown>);
  }

  export const TAU: number;
}
