"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface SceneErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

export default class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("No se pudo cargar el modelo 3D.", error, info.componentStack);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="scene-state" role="alert">
          No se pudo abrir este modelo. Comprueba que sea un GLB válido y vuelve a seleccionarlo.
        </div>
      );
    }
    return this.props.children;
  }
}
