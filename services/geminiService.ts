import { GoogleGenAI, Type } from "@google/genai";
import { MAGISTRADO_SYSTEM_INSTRUCTION } from "../constants";
import { SentenceRequest, SentenceResponse, LegalMatter, ChatMessage, SemanticAnalysisResult } from "../types";

export const generateSentence = async (request: SentenceRequest): Promise<SentenceResponse> => {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  // 1. Declarar 'ai' PRIMERO
  const ai = new GoogleGenAI({ apiKey });
  
  // 2. Declarar 'parts' PRIMERO con el prompt original
  const parts: any[] = [
      { text: `
    INSTRUCCIÓN DE PRIORIDAD MÁXIMA: 
    Actúa como un Juez de Distrito o Magistrado de Circuito Experto.
    OBJETIVO PRINCIPAL: EXHAUSTIVIDAD TOTAL Y FORMATO IMPECABLE.

    REGLAS DE FORMATO Y ESTILO:
    1. **USO DE NEGRITAS**: ÚSALAS EXCLUSIVAMENTE PARA:
       - Encabezados de sección (ej. **RESULTANDOS**, **CONSIDERANDOS**).
       - Nombres de las partes (ej. **JUAN PÉREZ**).
       - Cantidades monetarias o penas (ej. **$50,000.00 M.N.**).
       - Puntos resolutivos (ej. **SEGUNDO.- Se condena...**).
       - NO pongas negritas en palabras aleatorias o énfasis innecesarios dentro del párrafo.
    2. **ESTILO**: Solemne, técnico y JUSTIFICADO. Redacción continua y fluida.

    TAREA 1: PROYECTO DE SENTENCIA (Campo 'projectText')
    - Redacta una SENTENCIA DEFINITIVA lista para firma.
    - EXTENSIÓN: Masiva. No omitas detalles. Transcribe lo necesario.
    - ESTRUCTURA: Vistos, Resultandos (Cronología detallada), Considerandos (Competencia, Vía, Personalidad, Litis, Estudio de Fondo exhaustivo, Valoración de Pruebas individual), Resolutivos.
    - VALORACIÓN DE PRUEBAS: Analiza cada prueba individualmente, relacionándola con los hechos.
    - CONSIDERANDOS: Explica el "POR QUÉ" de cada decisión parcial de forma extensa.
    - DATOS: Usa estrictamente el PDF.

    TAREA 2: RATIO DECIDENDI Y SUSTENTO (Campo 'ratioDecidendi')
    - IMPORTANTE: Este apartado NO es un resumen. Es el "PLIEGO DE RAZONAMIENTO JURÍDICO" para sustentar el fallo ante una apelación o amparo.
    - EXTENSIÓN: Mínimo 1500 palabras. EXHAUSTIVO.
    - ESTRUCTURA OBLIGATORIA PARA LA RATIO:
      A) TESIS CENTRAL DEL FALLO: ¿Cuál es el núcleo lógico de la decisión? (El "Por qué" jurídico).
      B) NEXO CAUSAL PROBATORIO: Vincula hechos específicos del archivo PDF con la norma. Ejemplo: "La prueba X (foja Y) demuestra Z, lo cual actualiza la hipótesis del artículo N".
      C) JUSTIFICACIÓN DE LOS CONSIDERANDOS: Explica por qué se desestimaron las excepciones de la contraparte. ¿Por qué su argumento falló?
      D) SUSTENTO JURISPRUDENCIAL Y DOCTRINAL: Cita tesis, jurisprudencias o principios generales del derecho que blindan esta decisión.
      E) CONCLUSIÓN SILOGÍSTICA: Premisa Mayor (Ley) + Premisa Menor (Hechos probados) = Conclusión (Fallo).

    NOTAS ADICIONALES DEL JUZGADOR / HECHOS:
    ${request.judgeNotes}
      `}
  ];

  // 3. Procesar el archivo (ÚNICO BLOQUE DE ARCHIVO)
  if (request.caseFile) { 
    try {
      // Subir el archivo a los servidores de Gemini mediante File API
      const uploadResult = await ai.files.upload({
        file: request.caseFile,
        // En el nuevo SDK, mimeType va dentro de config
        config: {
            mimeType: request.caseFile.type,
        }
      });

      // Pasar el identificador (URI) al modelo
      parts.push({ 
        fileData: { 
          mimeType: uploadResult.mimeType || request.caseFile.type, 
          fileUri: uploadResult.uri 
        } 
      });
    } catch (e) {
      console.error("Error subiendo el archivo a Gemini:", e);
      throw new Error("Error al procesar el archivo PDF. Intente nuevamente.");
    }
  }

  // 4. Generar el contenido
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: { parts: parts },
      config: {
        systemInstruction: MAGISTRADO_SYSTEM_INSTRUCTION,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                projectText: { type: Type.STRING, description: "El texto completo y formateado de la sentencia. Usa Markdown para estructura." },
                ratioDecidendi: { type: Type.STRING, description: "Análisis exhaustivo, silogismo jurídico, valoración probatoria profunda y sustento jurisprudencial." },
                detectedMatter: { type: Type.STRING, enum: Object.values(LegalMatter), description: "La materia legal detectada." }
            },
            required: ["projectText", "ratioDecidendi", "detectedMatter"]
        }
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("La IA no generó respuesta.");

    const parsed = JSON.parse(jsonText);

    return {
      text: parsed.projectText || "Error en generación de texto.",
      ratioDecidendi: parsed.ratioDecidendi || "No se generó ratio decidendi.",
      matterDetected: parsed.detectedMatter || LegalMatter.UNKNOWN
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("400")) {
      throw new Error("Error de solicitud (400). Posiblemente el archivo es demasiado grande o el formato no es válido.");
    }
    throw new Error(error.message || "Error al generar la sentencia.");
  }
};

export const editSentenceFragment = async (fragment: string, instruction: string): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
            { role: 'user', parts: [{ text: `
                ERES UN EDITOR JURÍDICO EXPERTO.
                
                TEXTO ORIGINAL SELECCIONADO: 
                "${fragment}"
                
                INSTRUCCIÓN DEL USUARIO: 
                "${instruction}"
                
                TU TAREA:
                Reescribe el texto seleccionado obedeciendo la instrucción del usuario.
                Mantén la coherencia con el lenguaje jurídico y el formato justificado.
                DEVUELVE SOLAMENTE EL TEXTO REESCRITO, SIN COMILLAS NI EXPLICACIONES.
            ` }] }
        ],
        config: {
            temperature: 0.3,
        }
    });

    return response.text || fragment;
};

export const analyzeLegislation = async (fullText: string): Promise<SemanticAnalysisResult> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    
    const ai = new GoogleGenAI({ apiKey });

    // Using Gemini 3 Flash for fast JSON extraction
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
            { role: 'user', parts: [{ text: `
                Analiza el siguiente texto de sentencia judicial y extrae TODAS las citas legales, artículos y jurisprudencias mencionadas.
                Para cada una, indica qué ley es y explica BREVEMENTE cómo se está aplicando en este caso específico.
                
                TEXTO: "${fullText.substring(0, 30000)}..." 
            ` }] }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    citations: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                article: { type: Type.STRING, description: "El número del artículo o nombre de la tesis" },
                                law: { type: Type.STRING, description: "La ley, código o fuente (ej. Código de Comercio)" },
                                application: { type: Type.STRING, description: "Explicación breve de por qué se aplica aquí" },
                                relevance: { type: Type.STRING, enum: ["alta", "media", "baja"] }
                            }
                        }
                    }
                }
            }
        }
    });

    const jsonText = response.text || '{ "citations": [] }';
    try {
        return JSON.parse(jsonText) as SemanticAnalysisResult;
    } catch (e) {
        console.error("Error parsing JSON semantic analysis", e);
        return { citations: [] };
    }
};

export const chatWithSentence = async (currentSentence: string, history: ChatMessage[], newMessage: string, mode: 'chat' | 'analysis'): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  
  const ai = new GoogleGenAI({ apiKey });

  let systemInstruction = "";
  let userPrompt = "";

  if (mode === 'analysis') {
      systemInstruction = "Eres un auditor jurídico experto (JUXA Analytics). Tu trabajo es encontrar contradicciones lógicas, falta de fundamentación, errores en fechas o puntos débiles apelables en el texto de la sentencia proporcionada.";
      userPrompt = `Analiza el siguiente texto de sentencia y busca: 1. Contradicciones internas. 2. Puntos débiles en la argumentación. 3. Errores posibles. TEXTO: ${currentSentence}`;
  } else {
      systemInstruction = "Eres un asistente legal experto ayudando a un juez a pulir una sentencia. Eres breve, directo y técnico.";
      userPrompt = `Basado en este texto de sentencia: "${currentSentence.substring(0, 10000)}..." \n\n El usuario pregunta: ${newMessage}`;
  }
  
  const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      config: {
        systemInstruction: systemInstruction
      }
  });

  return response.text || "No se pudo generar respuesta.";
};