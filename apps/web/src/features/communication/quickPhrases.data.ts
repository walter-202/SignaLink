import { QuickPhrase } from './draft-response.types';

/**
 * Frases frecuentes predeterminadas para atención al público en trámites (Español -> LSB).
 * Estas frases se conectan directamente con los videos/señas estandarizados de LSB.
 */
export const DEFAULT_QUICK_PHRASES: QuickPhrase[] = [
  {
    id: 'qp-1',
    category: 'saludo',
    label: 'Saludo de bienvenida',
    text: '¡Hola! ¿En qué trámite podemos ayudarte hoy?',
  },
  {
    id: 'qp-2',
    category: 'requisito',
    label: 'Documento de identidad',
    text: 'Para el registro necesita presentar su documento de identidad.',
  },
  {
    id: 'qp-3',
    category: 'horario',
    label: 'Horario de atención',
    text: 'Puede realizarlo de lunes a viernes, de 8:00 a 16:00.',
  },
  {
    id: 'qp-4',
    category: 'requisito',
    label: 'Fotocopia de cédula',
    text: 'Por favor, traiga una fotocopia de su cédula de identidad y su certificado de nacimiento.',
  },
  {
    id: 'qp-5',
    category: 'general',
    label: 'Aguarde un momento',
    text: 'Por favor, tome asiento y aguarde un momento mientras procesamos su solicitud.',
  },
  {
    id: 'qp-6',
    category: 'despedida',
    label: 'Trámite finalizado',
    text: 'Su trámite ha concluido satisfactoriamente. ¡Que tenga un buen día!',
  },
];
