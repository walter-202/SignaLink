import type { ConversationMessage, HistoryRecord } from "../domain/types";

const demoAnchor = new Date(2024, 7, 15, 23, 59, 59);
const procedureTypes = [
  "Registro ciudadano",
  "Certificado de nacimiento",
  "Renovación de cédula",
  "Información general",
  "Certificado de antecedentes",
  "Orientación de trámites",
];
const offsets = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 28, 29, 30];

const starterConversation: ConversationMessage[] = [
  {
    id: "msg-1",
    sender: "citizen",
    text: "Quiero información sobre mi registro.",
    time: "10:20",
    state: "confirmed",
    source: "reviewed-sign",
  },
  {
    id: "msg-2",
    sender: "staff",
    text: "Para el registro necesita presentar su documento de identidad.",
    time: "10:22",
    state: "sent",
    source: "typed",
  },
  {
    id: "msg-3",
    sender: "citizen",
    text: "¿En qué horario puedo hacerlo?",
    time: "10:23",
    state: "confirmed",
    source: "reviewed-sign",
  },
  {
    id: "msg-4",
    sender: "staff",
    text: "Puede realizarlo de lunes a viernes, de 8:00 a 16:00.",
    time: "10:24",
    state: "sent",
    source: "typed",
  },
];

function dateWithOffset(daysAgo: number, index: number): string {
  const date = new Date(demoAnchor);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(10 + (index % 7), (index * 13) % 60, 0, 0);
  return date.toISOString();
}

export const MOCK_HISTORY: HistoryRecord[] = offsets.map((daysAgo, index) => {
  const number = 18 - index;
  const conversation = index === 0
    ? starterConversation
    : [
        {
          id: `mock-${number}-1`,
          sender: "citizen" as const,
          text: index % 2 === 0
            ? "Necesito orientación para este trámite."
            : "¿Qué documentos debo presentar?",
          time: "10:20",
          state: "confirmed" as const,
          source: "reviewed-sign" as const,
        },
        {
          id: `mock-${number}-2`,
          sender: "staff" as const,
          text: index % 2 === 0
            ? "Con gusto, le explico los pasos disponibles."
            : "Puede consultar los requisitos en esta oficina.",
          time: "10:24",
          state: "sent" as const,
          source: "typed" as const,
        },
      ];

  return {
    id: `AT-2024-${String(number).padStart(4, "0")}`,
    procedureType: procedureTypes[index % procedureTypes.length],
    startedAt: dateWithOffset(daysAgo, index),
    status: index === 0 ? "active" : index === 12 ? "cancelled" : "completed",
    durationMinutes: [12, 18, 14, 9, 16, 11, 7, 13, 10][index % 9],
    messages: conversation,
    notes: index === 0 ? "" : index % 4 === 0 ? "Atención de demostración." : "",
  };
});

export const MOCK_HISTORY_ANCHOR = demoAnchor;
