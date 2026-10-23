import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LsbExpression } from "@/features/lsb-catalog/domain/lsb-expression";

const scene = vi.hoisted(() => ({
  clips: ["Armature|HOLA", "Armature|GRACIAS"],
  // Three.js reports clip durations in seconds.
  durations: { "Armature|HOLA": 2.4, "Armature|GRACIAS": 1.8 },
}));

vi.mock("@/features/avatar/AvatarScene", async () => {
  const React = await import("react");
  interface MockSceneProps {
    modelUrl: string | null;
    animationName: string;
    isPlaying: boolean;
    isLooping: boolean;
    restartToken?: number;
    onAnimationsLoaded: (names: string[]) => void;
    onClipDurations?: (durations: Record<string, number>) => void;
  }
  const MockAvatarScene = (props: MockSceneProps) => {
    const {
      modelUrl,
      animationName,
      isPlaying,
      isLooping,
      restartToken,
      onAnimationsLoaded,
      onClipDurations,
    } = props;
    React.useEffect(() => {
      if (!modelUrl) return;
      onAnimationsLoaded(scene.clips);
      onClipDurations?.(scene.durations);
    }, [modelUrl, onAnimationsLoaded, onClipDurations]);
    return (
      <div
        data-testid="scene"
        data-animation={animationName}
        data-playing={String(isPlaying)}
        data-looping={String(isLooping)}
        data-restart={String(restartToken ?? 0)}
      />
    );
  };
  return { default: MockAvatarScene };
});

function expression(overrides: Partial<LsbExpression> = {}): LsbExpression {
  return {
    id: "hola",
    spanish: "Hola",
    aliases: [],
    page: 56,
    gloss: null,
    animationClipId: "HOLA",
    animationSource: "SIGNALINK",
    animationStatus: "provisional",
    validation: "sin-revision",
    ...overrides,
  };
}

async function renderPreview(value?: LsbExpression | null) {
  const { AvatarPreview } = await import("./AvatarPreview");
  return render(<AvatarPreview expression={value} />);
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_LSB_AVATAR_MODEL_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AvatarPreview", () => {
  it("plays only the exact mapped clip and shows its real duration", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_LSB_AVATAR_MODEL_URL",
      "https://example.com/avatar.glb",
    );
    await renderPreview(expression());
    await userEvent.click(
      screen.getByRole("button", { name: "Buscar clip «Hola»" }),
    );
    await screen.findByTestId("scene");
    await waitFor(() =>
      expect(screen.getByTestId("scene")).toHaveAttribute(
        "data-animation",
        "Armature|HOLA",
      ),
    );
    expect(screen.getByTestId("scene")).toHaveAttribute("data-playing", "true");
    expect(screen.getByText(/Clip «Armature\|HOLA» listo/)).toBeInTheDocument();
    expect(screen.getByText("0:00 / 0:02")).toBeInTheDocument();
  });

  it("keeps the bundled avatar unloaded until the user requests it", async () => {
    await renderPreview(expression());
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /avatar de demostración; esta imagen no representa/i,
      }),
    ).toHaveAttribute("loading", "eager");
    await userEvent.click(
      screen.getByRole("button", { name: "Ver «Hola» en 3D · 20.5 MB" }),
    );
    await screen.findByTestId("scene");
    await waitFor(() =>
      expect(screen.getByTestId("scene")).toHaveAttribute(
        "data-animation",
        "Armature|HOLA",
      ),
    );
    expect(screen.getByTestId("scene")).toHaveAttribute("data-playing", "true");
    expect(
      screen.getByText(/Modelo:\s*Avatar demostrativo/),
    ).toBeInTheDocument();
  });

  it("keeps the provisional figure when the bundled avatar is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_LSB_AVATAR_MODEL_URL", "off");
    await renderPreview(expression());
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /avatar de demostración/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reproducir animación LSB" }),
    ).toBeDisabled();
    expect(
      screen.getByText("El avatar 3D está desactivado en esta instalación."),
    ).toBeInTheDocument();
  });

  it("does not fall back to another clip when the model lacks the mapped one", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_LSB_AVATAR_MODEL_URL",
      "https://example.com/avatar.glb",
    );
    await renderPreview(expression({ animationClipId: "NO_EXISTE" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Buscar clip «Hola»" }),
    );
    await screen.findByTestId("scene");
    await waitFor(() =>
      expect(screen.getByTestId("scene")).toHaveAttribute("data-animation", ""),
    );
    expect(screen.getByTestId("scene")).toHaveAttribute(
      "data-playing",
      "false",
    );
    expect(
      screen.getByText(/no incluye el clip «NO_EXISTE»/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reproducir animación LSB" }),
    ).toBeDisabled();
  });

  it("states when an expression has no mapped animation", async () => {
    await renderPreview(
      expression({ animationClipId: null, animationSource: null }),
    );
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
    expect(
      screen.getByText(/no tiene una animación LSB registrada/),
    ).toBeInTheDocument();
  });

  it("asks for a catalog selection when there is no expression", async () => {
    await renderPreview();
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Selecciona una expresión del catálogo/),
    ).toBeInTheDocument();
  });

  it("pauses and resumes the active clip", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_LSB_AVATAR_MODEL_URL",
      "https://example.com/avatar.glb",
    );
    await renderPreview(expression());
    await userEvent.click(
      screen.getByRole("button", { name: "Buscar clip «Hola»" }),
    );
    await screen.findByTestId("scene");
    await waitFor(() =>
      expect(screen.getByTestId("scene")).toHaveAttribute(
        "data-animation",
        "Armature|HOLA",
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Pausar animación LSB" }),
    );
    expect(screen.getByTestId("scene")).toHaveAttribute(
      "data-playing",
      "false",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reproducir animación LSB" }),
    );
    expect(screen.getByTestId("scene")).toHaveAttribute("data-playing", "true");
  });

  it("stops the clip by remounting the scene and toggles repeat", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_LSB_AVATAR_MODEL_URL",
      "https://example.com/avatar.glb",
    );
    await renderPreview(expression());
    await userEvent.click(
      screen.getByRole("button", { name: "Buscar clip «Hola»" }),
    );
    await screen.findByTestId("scene");
    await waitFor(() =>
      expect(screen.getByTestId("scene")).toHaveAttribute(
        "data-animation",
        "Armature|HOLA",
      ),
    );
    const restart = Number(
      screen.getByTestId("scene").getAttribute("data-restart"),
    );
    const repeat = screen.getByRole("button", {
      name: "Repetir animación LSB",
    });
    expect(repeat).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(repeat);
    expect(repeat).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      screen.getByRole("button", { name: "Detener animación LSB" }),
    );
    await waitFor(() => {
      const nextScene = screen.getByTestId("scene");
      expect(nextScene).toHaveAttribute("data-restart", String(restart + 1));
      expect(nextScene).toHaveAttribute("data-playing", "false");
    });
  });
});
