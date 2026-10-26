import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LsbExpressionPanel } from "./LsbExpressionPanel";

describe("LsbExpressionPanel", () => {
  it("opens provisional alphabet studies separately from the attention session", async () => {
    const user = userEvent.setup();
    render(<LsbExpressionPanel draft="Hola" />);
    await user.click(screen.getByText("Explorar dactilología"));
    for (const letter of ["A", "B", "L"]) {
      const link = screen.getByRole("link", { name: `Revisar postura ${letter} en el laboratorio 3D` });
      expect(link).toHaveAttribute("href", `/avatar-lab?study=${letter}`);
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("shows a catalog match directly from the response draft", () => {
    const onResolved = vi.fn();
    render(<LsbExpressionPanel draft="Gracias" onResolved={onResolved} />);

    const card = screen.getByRole("article", { name: "Ficha de Gracias" });
    expect(within(card).getByText(/p\. 56/)).toBeInTheDocument();
    expect(within(card).getByText("No incluido en la app")).toBeInTheDocument();
    expect(
      within(card).getByText("Sin revisión lingüística registrada"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Usar el borrador" }),
    ).not.toBeInTheDocument();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("shows the model's actual clip availability when it has been loaded", () => {
    render(
      <LsbExpressionPanel
        draft="Hola"
        availableModelClips={["Armature|HOLA"]}
      />,
    );

    const card = screen.getByRole("article", { name: "Ficha de Hola" });
    expect(within(card).getByText("Disponible en este modelo")).toBeInTheDocument();
  });

  it("explains that a phrase outside the catalog has no documented expression", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(
      <LsbExpressionPanel draft="Necesito ayuda" onResolved={onResolved} />,
    );

    await user.type(
      screen.getByRole("textbox", { name: "Buscar expresión" }),
      "Nos vemos luego",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(
      screen.getByText(/no se inventan traducciones ni glosas/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(onResolved).toHaveBeenLastCalledWith(null, "Necesito ayuda");
  });

  it("keeps manual catalog browsing distinct from the exact response draft", async () => {
    const user = userEvent.setup();
    render(<LsbExpressionPanel draft="Hola" />);

    await user.type(
      screen.getByRole("textbox", { name: "Buscar expresión" }),
      "Gracias",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(
      screen.getByRole("article", { name: "Ficha de Gracias" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/vista 3D sigue la expresión exacta del borrador/i)).toHaveTextContent(
      "Hola",
    );
  });

  it("invalidates a manual catalog selection when the response draft changes", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    const { rerender } = render(
      <LsbExpressionPanel draft="Necesito ayuda" onResolved={onResolved} />,
    );

    await user.click(screen.getByRole("button", { name: "Ver las 19 expresiones" }));
    await user.click(
      screen.getByRole("button", { name: /Ver ficha de Hola/i }),
    );
    expect(screen.getByRole("article", { name: "Ficha de Hola" })).toBeInTheDocument();
    expect(onResolved).toHaveBeenLastCalledWith(
      expect.objectContaining({ spanish: "Hola", page: 56 }),
      "Necesito ayuda",
    );

    rerender(
      <LsbExpressionPanel draft="Quiero apoyo" onResolved={onResolved} />,
    );

    expect(screen.queryByRole("article", { name: "Ficha de Hola" })).not.toBeInTheDocument();
    expect(screen.getByText(/El borrador cambió/)).toBeInTheDocument();
  });

  it("lists all 19 documented expressions with model availability", async () => {
    const user = userEvent.setup();
    render(<LsbExpressionPanel draft="" />);

    await user.click(screen.getByRole("button", { name: "Ver las 19 expresiones" }));

    expect(screen.getAllByRole("button", { name: /ver ficha de/i })).toHaveLength(19);
    expect(
      screen.getByRole("button", { name: /ver ficha de Hola; Clip provisional/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("3D provisional")).toBeInTheDocument();
    expect(
      screen.getAllByText("No integrado", {
        selector: ".lsb-catalog-availability",
      }),
    ).toHaveLength(18);
  });

  it("asks for a phrase when an empty catalog search is submitted", async () => {
    const user = userEvent.setup();
    render(<LsbExpressionPanel draft="" />);

    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(screen.getByText(/en «Redactar respuesta»/i)).toBeInTheDocument();
  });
});
