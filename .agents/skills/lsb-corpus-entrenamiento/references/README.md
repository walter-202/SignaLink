# Fuentes y estado del vocabulario LSB

## Fuentes de partida

El Ministerio de Educación de Bolivia identifica estas publicaciones como los módulos del Curso de enseñanza de la Lengua de Señas Boliviana. Las fichas indican autor institucional, lugar y fecha editorial. No incluyen en la ficha consultada términos explícitos de licencia para redistribuir o adaptar el contenido.

| Módulo | Ficha oficial |
|---|---|
| Módulo 1 | [Ministerio de Educación — Módulo 1](https://www.minedu.gob.bo/index.php?Itemid=1132&id=416%3Acurso-de-ensenanza-de-la-lengua-de-senas-boliviana-lsb-modulo-1&option=com_k2&view=item) |
| Módulo 2 | [Ministerio de Educación — Módulo 2](https://www.minedu.gob.bo/index.php?Itemid=1132&id=417%3Acurso-de-ensenanza-de-la-lengua-de-senas-boliviana-lsb-modulo-2&option=com_k2&view=item) |
| Módulo 3 | [Ministerio de Educación — Módulo 3](https://www.minedu.gob.bo/index.php?id=418%3Acurso-de-ensenanza-de-la-lengua-de-senas-boliviana-lsb-modulo-3&option=com_k2&view=item) |
| Módulo 4 | [Ministerio de Educación — Módulo 4](https://www.minedu.gob.bo/index.php?Itemid=1132&id=419%3Acurso-de-ensenanza-de-la-lengua-de-senas-boliviana-lsb-modulo-4&option=com_k2&view=item) |

Las fichas describen el material como publicado en diciembre de 2010 y disponible para descarga. La disponibilidad gratuita no confirma por sí sola permiso para republicar una extracción. La licencia del código del proyecto y los derechos de materiales lingüísticos deben revisarse por separado.

## Estado de la contribución Apaza

La rama Apaza aporta notas, ejemplos, herramientas y un archivo vocabulario_lsb.json. Su commit de origen es 9e104c0.

El JSON no se integra en main por ahora. La auditoría del archivo encontró:

- 1.381 registros declarados.
- 1.367 identificadores únicos; 14 registros repiten un ID, agrupados en 11 IDs.
- 51 glosas vacías.
- 12 registros sin página de referencia.

Además, el conteo de 1.381 no coincide con el inventario previo citado en `.agents/skills/lsb-traduccion-lengua-senas/SKILL.md`. No se afirma un total oficial hasta reconciliar los índices de los cuatro módulos y validar el extractor.

## Requisitos antes de publicar el JSON

1. Documentar permiso aplicable a la extracción, redistribución y uso previsto.
2. Verificar cada registro contra el índice fuente, con módulo y página.
3. Resolver duplicados, glosas vacías y referencias faltantes; conservar el historial de corrección.
4. Revisar etiquetas y variantes con una persona competente en LSB.
5. Regenerar el archivo y repetir las comprobaciones de calidad.

Mientras tanto, el extractor puede usarse solo con documentos cuyo uso esté autorizado y su salida debe permanecer local. El archivo derivado no se debe subir a GitHub ni utilizar como corpus aprobado.

## Estado de las notas y ejemplos

Los documentos de gramática, parámetros formacionales y entrenamiento son notas de trabajo sin revisión línea por línea contra páginas de la fuente ni aprobación lingüística. Los JSON de examples son ejemplos ilustrativos, no pares de traducción validados. No deben usarse como etiquetas, evidencia de precisión o contenido de cara al público.
