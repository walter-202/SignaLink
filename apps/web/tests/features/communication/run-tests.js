// Runner ligero de pruebas unitarias para features de comunicación
function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FALLÓ: ${message}`);
      failed++;
    } else {
      console.log(`✅ PASÓ: ${message}`);
      passed++;
    }
  }

  console.log("=== EJECUTANDO TEST SUITE: REDACTAR RESPUESTA (COMMUNICATION) ===");

  // Simulación de Estado y Lógica del Hook useDraftResponse
  class DraftResponseManager {
    constructor(maxChars = 500, driver = null) {
      this.maxChars = maxChars;
      this.text = "";
      this.interim = "";
      this.inputMode = "keyboard";
      this.isDictating = false;
      this.error = null;
      this.driver = driver;
    }

    setText(newText) {
      this.text = newText.slice(0, this.maxChars);
    }

    appendChunk(chunk) {
      const trimmed = chunk.trim();
      if (!trimmed) return;
      const combined = this.text ? `${this.text} ${trimmed}` : trimmed;
      this.text = combined.slice(0, this.maxChars);
    }

    toggleDictation() {
      if (!this.driver || !this.driver.isSupported) {
        this.error = "No soportado";
        return;
      }
      if (this.isDictating) {
        this.driver.stop();
        this.isDictating = false;
        this.interim = "";
      } else {
        this.isDictating = true;
        this.inputMode = "voice";
        this.error = null;
        this.driver.start(
          (chunk, isFinal) => {
            if (isFinal) {
              this.appendChunk(chunk);
              this.interim = "";
            } else {
              this.interim = chunk;
            }
          },
          (err) => {
            this.error = err;
            this.isDictating = false;
          }
        );
      }
    }

    selectPhrase(phrase) {
      this.setText(phrase.text);
      this.inputMode = "quick-phrases";
    }

    submit(callback) {
      const trimmed = this.text.trim();
      if (!trimmed) {
        this.error = "No puedes enviar una respuesta vacía.";
        return;
      }
      this.error = null;
      callback(trimmed);
    }
  }

  // TEST 1: Inicialización y límite de caracteres
  const manager = new DraftResponseManager(20);
  assert(manager.text === "", "Inicializa vacío");
  manager.setText("12345678901234567890EXTRA");
  assert(manager.text.length === 20, "Trunca exactamente a maxChars (20)");

  // TEST 2: Concatenación y adición de chunks por voz
  manager.setText("Hola");
  manager.appendChunk("buenos días");
  assert(manager.text === "Hola buenos días", "Concatena correctamente chunks con espacio");

  // TEST 3: Driver de reconocimiento y dictado interactivo
  let mockCallback = null;
  const mockDriver = {
    isSupported: true,
    start: (cb) => { mockCallback = cb; },
    stop: () => {}
  };

  const voiceManager = new DraftResponseManager(500, mockDriver);
  voiceManager.toggleDictation();
  assert(voiceManager.isDictating === true, "Dictado activado correctamente");
  assert(voiceManager.inputMode === "voice", "Modo cambiado a voice");

  // Simular streaming provisional
  mockCallback("Para el registro", false);
  assert(voiceManager.interim === "Para el registro", "Guarda interim transcript mientras habla");
  assert(voiceManager.text === "", "Texto final permanece intacto durante interim");

  // Simular transcripción final
  mockCallback("Para el registro presente su carnet.", true);
  assert(voiceManager.interim === "", "Limpia interim al finalizar la frase");
  assert(voiceManager.text === "Para el registro presente su carnet.", "Consolida texto final en la respuesta");

  // TEST 4: Selección de Frases Frecuentes
  voiceManager.selectPhrase({ id: "qp-1", text: "Puede realizarlo de lunes a viernes." });
  assert(voiceManager.text === "Puede realizarlo de lunes a viernes.", "Carga texto de frase frecuente");
  assert(voiceManager.inputMode === "quick-phrases", "Modo cambiado a quick-phrases");

  // TEST 5: Validación de envío
  let submittedText = null;
  voiceManager.setText("");
  voiceManager.submit((val) => { submittedText = val; });
  assert(submittedText === null, "Bloquea envío de texto vacío");
  assert(voiceManager.error === "No puedes enviar una respuesta vacía.", "Muestra error adecuado");

  voiceManager.setText("Trámite finalizado.");
  voiceManager.submit((val) => { submittedText = val; });
  assert(submittedText === "Trámite finalizado.", "Permite envío de texto válido");
  assert(voiceManager.error === null, "Limpia errores anteriores tras envío exitoso");

  console.log(`\nRESUMEN: ${passed} pruebas pasaron, ${failed} fallaron.`);
  if (failed > 0) process.exit(1);
}

runTests();
