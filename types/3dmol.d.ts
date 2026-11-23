declare module '3dmol' {
  export interface GLViewer {
    addModel(data: string, format: string, options?: Record<string, unknown>): unknown;
    setStyle(sel: Record<string, unknown>, style: Record<string, unknown>): void;
    setBackgroundColor(color: string | number, alpha?: number): void;
    zoomTo(): void;
    zoom(factor: number, duration?: number): void;
    rotate(angle: number, axis?: string): void;
    spin(axis?: string | boolean, speed?: number): void;
    render(): void;
    resize(): void;
    clear(): void;
    removeAllModels(): void;
    setHoverable(
      sel: Record<string, unknown>,
      enable: boolean,
      hoverCallback?: (atom: Record<string, unknown>, viewer: GLViewer) => void,
      unhoverCallback?: (atom: Record<string, unknown>, viewer: GLViewer) => void
    ): void;
    setClickable(
      sel: Record<string, unknown>,
      enable: boolean,
      clickCallback?: (atom: Record<string, unknown>, viewer: GLViewer) => void
    ): void;
  }

  export function createViewer(
    element: HTMLElement,
    config?: Record<string, unknown>
  ): GLViewer;
}

declare module 'plotly.js-dist-min' {
  const Plotly: {
    react(
      root: HTMLElement,
      data: Array<Record<string, unknown>>,
      layout?: Record<string, unknown>,
      config?: Record<string, unknown>
    ): Promise<HTMLElement>;
    purge(root: HTMLElement): void;
    Plots: {
      resize(root: HTMLElement): void;
    };
  };
  export default Plotly;
}
