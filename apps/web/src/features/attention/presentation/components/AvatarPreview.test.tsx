import { render, screen, waitFor, within } from "@testing-library/react";
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

async function renderPreview(
  value?: LsbExpression | null,
  autoStart = false,
) {
  const { AvatarPreview } = await import("./AvatarPreview");
  return render(<AvatarPreview expression={value} autoStart={autoStart} />);
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
      screen.getByRole("button", {
        name: "Abrir escena 3D",
      }),
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
      within(screen.getByRole("dialog")).getByText(/Clip «Armature\|HOLA» listo/),
    ).toBeInTheDocument();
    expect(screen.getByText("0:00 / 0:02")).toBeInTheDocument();
  });

  it("keeps the bundled avatar unloaded until the user requests it", async () => {
    await renderPreview(expression());
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Abrir escena 3D" }),
    );
    await screen.findByRole("dialog", { name: "Vista 3D de respuesta" });
    await screen.findByTestId("scene");
    await waitFor(() =>
      expect(screen.getByTestId("scene")).toHaveAttribute(
        "data-animation",
        "Armature|HOLA",
      ),
    );
    expect(screen.getByTestId("scene")).toHaveAttribute("data-playing", "true");
    expect(screen.getByText("Modelo: Avatar demostrativo")).toBeInTheDocument();
  });

  it("automatically loads the exact catalog clip when requested by the response", async () => {
    await renderPreview(expression(), true);

    await screen.findByTestId("scene");
    await waitFor(() => {
      expect(screen.getByTestId("scene")).toHaveAttribute(
        "data-animation",
        "Armature|HOLA",
      );
      expect(screen.getByTestId("scene")).toHaveAttribute("data-playing", "true");
    });
    expect(
      screen.getByRole("dialog", { name: "Vista 3D de respuesta" }),
    ).toBeInTheDocument();
  });

  it("formats durations longer than a minute as minutes and seconds", async () => {
    const previousDuration = scene.durations["Armature|HOLA"];
    scene.durations["Armature|HOLA"] = 61.2;
    try {
      vi.stubEnv(
        "NEXT_PUBLIC_LSB_AVATAR_MODEL_URL",
        "https://example.com/avatar.glb",
      );
      await renderPreview(expression());
      await userEvent.click(
        screen.getByRole("button", {
          name: "Abrir escena 3D",
        }),
      );
      await screen.findByTestId("scene");
      await waitFor(() =>
        expect(screen.getByText("0:00 / 1:01")).toBeInTheDocument(),
      );
    } finally {
      scene.durations["Armature|HOLA"] = previousDuration;
    }
  });

  it("shows no reference image when the bundled avatar is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_LSB_AVATAR_MODEL_URL", "off");
    await renderPreview(expression());
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText("El avatar 3D está desactivado en esta instalación."),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Abrir escena 3D" }),
    );
    expect(
      await screen.findByRole("button", { name: "Reproducir animación LSB" }),
    ).toBeDisabled();
  });

  it("opens and plays the exact supported response automatically", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_LSB_AVATAR_MODEL_URL",
      "https://example.com/avatar.glb",
    );
    await renderPreview(expression(), true);
    const dialog = await screen.findByRole("dialog", {
      name: "Vista 3D de respuesta",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await screen.findByTestId("scene");
    await waitFor(() =>
      expect(screen.getByTestId("scene")).toHaveAttribute(
        "data-animation",
        "Armature|HOLA",
      ),
    );
    expect(screen.getByTestId("scene")).toHaveAttribute("data-playing", "true");
  });

  it("does not fall back to another clip when the model lacks the mapped one", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_LSB_AVATAR_MODEL_URL",
      "https://example.com/avatar.glb",
    );
    await renderPreview(expression({ animationClipId: "NO_EXISTE" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: "Abrir escena 3D",
      }),
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
      within(screen.getByRole("dialog")).getByText(/no incluye el clip «NO_EXISTE»/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reproducir animación LSB" }),
    ).toBeDisabled();
  });

  it("shows the catalog inside the 3D dialog", async () => {
    const { AvatarPreview } = await import("./AvatarPreview");
    render(
      <AvatarPreview
        expression={expression()}
        dialogCatalog={<div>Catálogo en el diálogo</div>}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Abrir escena 3D" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Vista 3D de respuesta",
    });
    expect(
      within(dialog).getByText("Catálogo en el diálogo"),
    ).toBeInTheDocument();
  });

  it("loads the model when a selection is made inside the dialog", async () => {
    const { AvatarPreview } = await import("./AvatarPreview");
    const catalog = <div>Catálogo en el diálogo</div>;
    const { rerender } = render(<AvatarPreview dialogCatalog={catalog} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Abrir escena 3D" }),
    );
    await screen.findByRole("dialog", { name: "Vista 3D de respuesta" });
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();

    rerender(<AvatarPreview expression={expression()} dialogCatalog={catalog} />);

    await screen.findByTestId("scene");
    await waitFor(() =>
      expect(screen.getByTestId("scene")).toHaveAttribute(
        "data-animation",
        "Armature|HOLA",
      ),
    );
  });

  it("integrates the catalog in the card without repeating the summary", async () => {
    const { AvatarPreview } = await import("./AvatarPreview");
    render(<AvatarPreview catalog={<div>Catálogo dentro de la vista</div>} />);

    expect(screen.getByText("Catálogo dentro de la vista")).toBeInTheDocument();
    expect(
      screen.queryByText("Sin coincidencia exacta"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Escribe una expresión exacta del catálogo/),
    ).not.toBeInTheDocument();
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
      screen.getByText(/Escribe una expresión exacta del catálogo/),
    ).toBeInTheDocument();
  });

  it("pauses and resumes the active clip", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_LSB_AVATAR_MODEL_URL",
      "https://example.com/avatar.glb",
    );
    await renderPreview(expression());
    await userEvent.click(
      screen.getByRole("button", {
        name: "Abrir escena 3D",
      }),
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
      screen.getByRole("button", {
        name: "Abrir escena 3D",
      }),
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
