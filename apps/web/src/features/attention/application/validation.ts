import { z } from "zod";

export const replyTextSchema = z.string()
  .trim()
  .min(1, "Escribe una respuesta antes de enviarla.")
  .max(500, "La respuesta no puede superar los 500 caracteres.");

export const procedureNotesSchema = z.string()
  .max(300, "Las observaciones no pueden superar los 300 caracteres.");
