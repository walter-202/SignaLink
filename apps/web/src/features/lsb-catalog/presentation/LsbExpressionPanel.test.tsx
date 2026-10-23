import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LsbExpressionPanel } from "./LsbExpressionPanel";

describe("LsbExpressionPanel", () => {
  it("explains that a phrase outside the catalog has no documented expression", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(
      <LsbExpressionPanel draft="Necesito ayuda" onResolved={onResolved} />,
    );

    await user.type(
      screen.getByRole("textbox", { name: "Buscar expresión documentada" }),
      "Nos vemos luego",
    );
    await user.click(
      screen.getByRole("button", { name: "Buscar en el catálogo" }),
    );

    expect(
      screen.getByText(/el sistema no inventa traducciones ni glosas/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(onResolved).toHaveBeenLastCalledWith(null);
  });

  it("shows the source page and the missing gloss and animation when the draft matches", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(<LsbExpressionPanel draft="Gracias" onResolved={onResolved} />);

    await user.click(screen.getByRole("button", { name: "Usar el borrador" }));

    const card = screen.getByRole("article", { name: "Ficha de Gracias" });
    expect(within(card).getByText(/p\. 56/)).toBeInTheDocument();
    expect(within(card).getByText("No documentada")).toBeInTheDocument();
    expect(within(card).getByText("No disponible")).toBeInTheDocument();
    expect(
      within(card).getByText("Sin revisión lingüística registrada"),
    ).toBeInTheDocument();
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ spanish: "Gracias", page: 56 }),
    );
  });

  it("lists the 19 documented greetings", async () => {
    const user = userEvent.setup();
    render(<LsbExpressionPanel draft="" />);

    await user.click(
      screen.getByRole("button", { name: "Ver los 19 saludos" }),
    );

    expect(
      screen.getAllByRole("button", { name: /ver ficha de/i }),
    ).toHaveLength(19);
    expect(
      screen.getByRole("button", { name: "Ver ficha de Hola" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver ficha de Te amo" }),
    ).toBeInTheDocument();
  });

  it("disables the draft shortcut when the draft is blank", () => {
    render(<LsbExpressionPanel draft="   " />);

    expect(
      screen.getByRole("button", { name: "Usar el borrador" }),
    ).toBeDisabled();
  });

  it("asks for a phrase when the search is submitted empty", async () => {
    const user = userEvent.setup();
    render(<LsbExpressionPanel draft="" />);

    await user.click(
      screen.getByRole("button", { name: "Buscar en el catálogo" }),
    );

    expect(screen.getByText(/en «Redactar respuesta»/i)).toBeInTheDocument();
  });

  it("opens a greeting from the catalog and closes the list", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(<LsbExpressionPanel draft="" onResolved={onResolved} />);

    await user.click(
      screen.getByRole("button", { name: "Ver los 19 saludos" }),
    );
    await user.click(screen.getByRole("button", { name: "Ver ficha de Hola" }));

    const card = screen.getByRole("article", { name: "Ficha de Hola" });
    expect(card).toBeInTheDocument();
    expect(
      within(card).getByText("Provisional (sin revisión)"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver ficha de Gracias" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Hola");
    expect(onResolved).toHaveBeenLastCalledWith(
      expect.objectContaining({ spanish: "Hola", page: 56 }),
    );
  });
});
