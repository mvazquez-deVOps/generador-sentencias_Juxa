import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, ChevronLeft, ChevronRight, FileDown, Edit3, Eye, SplitSquareHorizontal, MessageSquare, AlertTriangle, Send, X, Maximize2, Minimize2, RefreshCw, Sparkles, Scale, BookOpen, Quote, ArrowRight, Wand2, Save, Type, Lightbulb, Info, FileText } from 'lucide-react';
import { SentenceResponse, LegalMatter, ChatMessage, SemanticAnalysisResult } from '../types';
import { chatWithSentence, editSentenceFragment, analyzeLegislation } from '../services/geminiService';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface DocumentPreviewProps {
  data: SentenceResponse | null;
  isLoading: boolean;
  uploadedFile: File | null;
}

const CHARS_PER_PAGE = 3000;
const STORAGE_KEY = 'juxa_current_draft';

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ data, isLoading, uploadedFile }) => {
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editableText, setEditableText] = useState('');
  const [showPdfSplit, setShowPdfSplit] = useState(false);
  const [activeTab, setActiveTab] = useState<'project' | 'analytics' | 'semantic' | 'ratio'>('project');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Smart Edit State
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionRange, setSelectionRange] = useState<{start: number, end: number} | null>(null);
  const [isSmartEditLoading, setIsSmartEditLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [smartEditInput, setSmartEditInput] = useState('');
  const [showSmartEditDialog, setShowSmartEditDialog] = useState(false);

  // Semantic Analysis State
  const [semanticData, setSemanticData] = useState<SemanticAnalysisResult | null>(null);
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);

  // Chat / Analytics State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Initialize editable text when data arrives
  useEffect(() => {
    if (data?.text) {
      setEditableText(data.text);
      setSemanticData(null);
      setSaveStatus('unsaved');
    } else {
        // Try to load from local storage if no new data
        const savedDraft = localStorage.getItem(STORAGE_KEY);
        if (savedDraft) {
            setEditableText(savedDraft);
        }
    }
  }, [data]);

  // Auto-save logic
  useEffect(() => {
      if (!editableText) return;
      
      const timeoutId = setTimeout(() => {
          setSaveStatus('saving');
          localStorage.setItem(STORAGE_KEY, editableText);
          setTimeout(() => setSaveStatus('saved'), 800);
      }, 2000); // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(timeoutId);
  }, [editableText]);

  // Handle Pagination (Reactive to edits)
  useEffect(() => {
    if (editableText) {
      const splitTextIntoPages = (text: string) => {
        const paragraphs = text.split('\n');
        const newPages: string[] = [];
        let currentAccumulator = '';

        paragraphs.forEach((para) => {
          if ((currentAccumulator.length + para.length > CHARS_PER_PAGE) && currentAccumulator.length > 0) {
            newPages.push(currentAccumulator);
            currentAccumulator = para + '\n';
          } else {
            currentAccumulator += para + '\n';
          }
        });
        
        if (currentAccumulator.length > 0) {
          newPages.push(currentAccumulator);
        }
        return newPages;
      };

      setPages(splitTextIntoPages(editableText));
      setCurrentPage(prev => Math.min(prev, Math.max(0, splitTextIntoPages(editableText).length - 1)));
    } else {
      setPages([]);
    }
  }, [editableText]);

  const handleManualSave = () => {
      setSaveStatus('saving');
      localStorage.setItem(STORAGE_KEY, editableText);
      setTimeout(() => setSaveStatus('saved'), 500);
  };

  const handleCopy = () => {
    if (editableText) {
      navigator.clipboard.writeText(editableText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- SEMANTIC ANALYSIS LOGIC ---
  const handleTabChange = async (tab: 'project' | 'analytics' | 'semantic' | 'ratio') => {
      setActiveTab(tab);
      if (tab === 'semantic' && !semanticData && !isSemanticLoading && editableText) {
          setIsSemanticLoading(true);
          try {
              const result = await analyzeLegislation(editableText);
              setSemanticData(result);
          } catch (e) {
              console.error("Failed to analyze legislation", e);
          } finally {
              setIsSemanticLoading(false);
          }
      }
  };

  // --- SMART EDIT LOGIC ---
  const handleTextSelect = () => {
    if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        if (start !== end) {
            setSelectionRange({ start, end });
            setSelectedText(textareaRef.current.value.substring(start, end));
            setShowSmartEditDialog(true);
            setSmartEditInput(''); // Clear previous input
        }
    }
  };

  const executeSmartEdit = async (instruction: string) => {
      if (!selectionRange || !textareaRef.current) return;
      
      setIsSmartEditLoading(true);
      try {
          const originalFragment = textareaRef.current.value.substring(selectionRange.start, selectionRange.end);
          const newFragment = await editSentenceFragment(originalFragment, instruction);
          
          // Replace text
          const pre = textareaRef.current.value.substring(0, selectionRange.start);
          const post = textareaRef.current.value.substring(selectionRange.end);
          const newFullText = pre + newFragment + post;
          
          setEditableText(newFullText);
          setSelectionRange(null); 
          setSelectedText('');
          setShowSmartEditDialog(false);
          setSmartEditInput('');
          setSaveStatus('unsaved'); // Trigger save needed
      } catch (e) {
          console.error("Smart edit failed", e);
      } finally {
          setIsSmartEditLoading(false);
      }
  };

  // --- END SMART EDIT LOGIC ---

  const handleSendMessage = async (mode: 'chat' | 'analysis') => {
    if ((mode === 'chat' && !chatInput.trim()) || !editableText) return;
    
    setIsChatLoading(true);
    const userMsg = mode === 'chat' ? chatInput : "Realizar análisis de contradicciones y puntos débiles.";
    
    if (mode === 'chat') {
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatInput('');
    } else {
        setChatMessages([{ role: 'user', text: userMsg }]);
    }

    try {
        const response = await chatWithSentence(editableText, chatMessages, userMsg, mode);
        setChatMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
        setChatMessages(prev => [...prev, { role: 'model', text: "Error al conectar con JUXA Intelligence." }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const textToHtml = (text: string) => {
    // Basic Markdown to HTML conversion for Word
    let html = text
      .replace(/^# (.*$)/gim, '<h1 style="font-size: 16pt; text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 12pt;">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 14pt; text-align: center; font-weight: bold; margin-top: 12pt; margin-bottom: 12pt;">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 12pt; font-weight: bold; text-align: left; margin-top: 12pt;">$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*)\*/gim, '<i>$1</i>')
      .replace(/^\s*-\s+(.*)/gim, '<li>$1</li>')
      .replace(/\n\n/gim, '</p><p class="MsoNormal" style="margin-bottom: 0pt; text-align: justify; font-family: \'Times New Roman\', serif; font-size: 12pt; line-height: 1.5;">')
      .replace(/\n/gim, '<br />');

    // Wrap first paragraph if not wrapped
    if (!html.startsWith('<h') && !html.startsWith('<p')) {
        html = '<p class="MsoNormal" style="margin-bottom: 0pt; text-align: justify; font-family: \'Times New Roman\', serif; font-size: 12pt; line-height: 1.5;">' + html;
    }
    return html;
  };

  const handleDownloadWord = () => {
    if (!editableText) return;

    // PROJECT SENTENCE
    let htmlContent = textToHtml(editableText);

    // PAGE BREAK & RATIO DECIDENDI
    if (data?.ratioDecidendi) {
        htmlContent += '<br clear=all style="mso-special-character:line-break;page-break-before:always">'; // Explicit Page Break
        htmlContent += '<h1 style="font-size: 16pt; text-align: center; font-weight: bold; margin-top: 40px; text-transform: uppercase; color: #b45309;">ANEXO: RATIO DECIDENDI & SUSTENTO LEGAL</h1>';
        htmlContent += '<hr style="margin-bottom: 20px;" />';
        htmlContent += textToHtml(data.ratioDecidendi);
    }

    // PAGE BREAK & DISCLAIMER (Separate Sheet)
    htmlContent += '<br clear=all style="mso-special-character:line-break;page-break-before:always">';
    htmlContent += `
        <div style="display: flex; flex-direction: column; justify-content: center; height: 100vh; text-align: center; padding: 40px; border: 4px double #333; margin-top: 40px;">
            <h1 style="font-size: 24pt; font-weight: bold; text-transform: uppercase; margin-bottom: 40px; margin-top: 40px;">AVISO LEGAL Y DE CUMPLIMIENTO</h1>
            <h2 style="font-size: 14pt; color: #555; margin-bottom: 20px;">INTELIGENCIA ARTIFICIAL GENERATIVA (EU AI ACT)</h2>
            <hr style="width: 50%; margin: 20px auto; border-top: 1px solid #999;">
            <p style="font-size: 12pt; text-align: justify; line-height: 2; margin-bottom: 20px;">
                Este documento, incluyendo el Proyecto de Sentencia y la Ratio Decidendi, ha sido generado mediante el sistema <strong>JUXA Core v2.4</strong>.
            </p>
            <p style="font-size: 12pt; text-align: justify; line-height: 2; margin-bottom: 20px;">
                Conforme a las mejores prácticas regulatorias de la Unión Europea (EU AI Act) y estándares éticos internacionales para el uso de IA en el ámbito jurídico:
            </p>
            <ul style="font-size: 12pt; text-align: justify; line-height: 2; list-style-type: square; margin-left: 40px;">
                <li>El contenido constituye un <strong>borrador auxiliar</strong> y no sustituye el criterio jurídico humano, la firma ni la validación del Juez o Magistrado.</li>
                <li>La <strong>Ratio Decidendi</strong> y la fundamentación legal deben ser revisadas por un profesional del derecho cualificado antes de su emisión.</li>
                <li>El sistema procesa información bajo estrictos protocolos de seguridad, pero puede presentar alucinaciones en citas jurisprudenciales o hechos no contenidos explícitamente en el expediente fuente.</li>
            </ul>
            <p style="margin-top: 100px; font-size: 10pt; color: #999;">Generado por JUXA Intelligence | ${new Date().toLocaleDateString()}</p>
        </div>
    `;

    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Sentencia</title>
        <!-- Microsoft Word compatible styles -->
        <style>
            @page {
                size: 21.59cm 27.94cm;
                margin: 2.5cm 3cm 2.5cm 3cm;
                mso-page-orientation: portrait;
            }
            body { 
                font-family: 'Times New Roman', serif; 
                font-size: 12pt; 
                text-align: justify;
                line-height: 1.5;
            }
            p.MsoNormal, li.MsoNormal, div.MsoNormal {
                mso-style-parent: "";
                margin: 0cm;
                margin-bottom: .0001pt;
                mso-pagination: widow-orphan;
                font-size: 12.0pt;
                font-family: "Times New Roman";
                text-align: justify;
            }
        </style>
      </head>
      <body>${htmlContent}</body></html>
    `;

    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sentencia_${data?.matterDetected || 'JUXA'}_Completa.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPdf = async () => {
      if (!editableText) return;

      try {
        const pdfDoc = await PDFDocument.create();
        const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

        const fontSize = 11;
        const lineHeight = 14;
        const margin = 50;
        const { width, height } = pdfDoc.getPageSizes().LETTER;
        const textWidth = width - (margin * 2);

        let page = pdfDoc.addPage([width, height]);
        let y = height - margin;

        const checkPageBreak = () => {
            if (y < margin + lineHeight) {
                page = pdfDoc.addPage([width, height]);
                y = height - margin;
            }
        };

        const drawTextLine = (text: string, font: any, align: 'left' | 'center' = 'left') => {
            checkPageBreak();
            const textDims = font.widthOfTextAtSize(text, fontSize);
            let x = margin;
            if (align === 'center') {
                x = (width - textDims) / 2;
            }
            page.drawText(text, { x, y, size: fontSize, font });
            y -= lineHeight;
        };

        const processParagraph = (text: string) => {
            // Very basic markdown parsing
            const isHeader = text.startsWith('#');
            const cleanText = text.replace(/^#+ /, '').replace(/\*\*/g, ''); // Remove bold markers for PDF simplicity or map them
            const font = (isHeader || text.includes('**')) ? timesBold : timesRoman; // Simple heuristic: if paragraph has bold markers, bold whole line or check parts. 
            // Better heuristic: Split by **
            
            // For this implementation, we will bold Headers and try to respect **words** by splitting
            // Note: justify is hard in pdf-lib, defaulting to left/center
            const align = isHeader ? 'center' : 'left';
            
            // Split into words
            const words = text.split(' ');
            let line = '';
            
            for (const word of words) {
                let currentWord = word;
                let currentFont = timesRoman;
                
                // Check for basic bolding logic (very simplified)
                if (word.startsWith('**') && word.endsWith('**')) {
                    currentWord = word.replace(/\*\*/g, '');
                    currentFont = timesBold;
                } else if (text.startsWith('#')) {
                    currentFont = timesBold;
                    currentWord = word.replace(/^#+/, '');
                }

                const testLine = line + (line ? ' ' : '') + currentWord;
                const testWidth = currentFont.widthOfTextAtSize(testLine, fontSize); // Approximation if mixing fonts

                if (testWidth > textWidth) {
                    drawTextLine(line, isHeader ? timesBold : timesRoman, align); // Draw current line
                    line = currentWord;
                } else {
                    line = testLine;
                }
            }
            if (line) {
                drawTextLine(line, isHeader ? timesBold : timesRoman, align);
            }
            y -= (lineHeight * 0.5); // Paragraph spacing
        };

        // Split text by newlines
        const paragraphs = editableText.split('\n');
        for (const p of paragraphs) {
            if (p.trim()) processParagraph(p);
        }

        // Add Ratio if exists
        if (data?.ratioDecidendi) {
            page = pdfDoc.addPage([width, height]);
            y = height - margin;
            drawTextLine("RATIO DECIDENDI", timesBold, 'center');
            y -= lineHeight * 2;
            
            const ratioParas = data.ratioDecidendi.split('\n');
            for (const p of ratioParas) {
                if (p.trim()) processParagraph(p);
            }
        }

        // Disclaimer Page
        page = pdfDoc.addPage([width, height]);
        y = height / 2 + 50;
        drawTextLine("AVISO LEGAL (EU AI ACT)", timesBold, 'center');
        y -= lineHeight * 2;
        drawTextLine("Este documento es un borrador generado por IA.", timesRoman, 'center');
        drawTextLine("Debe ser validado por un experto.", timesRoman, 'center');

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Sentencia_${data?.matterDetected || 'JUXA'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } catch (e) {
          console.error("PDF Gen Error", e);
          alert("Error al generar PDF. Intente descargar en Word.");
      }
  };

  const getMatterColor = (matter: string) => {
    switch (matter) {
      case LegalMatter.PENAL: return 'bg-red-900/30 text-red-400 border-red-500/30';
      case LegalMatter.MERCANTIL: return 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30';
      case LegalMatter.CIVIL: return 'bg-blue-900/30 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const DisclaimerFooter = () => (
      <div className="mt-16 pt-8 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3 text-slate-500 max-w-2xl mx-auto bg-slate-50/5 p-6 rounded-lg border border-slate-200/20 shadow-inner">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-[10px] leading-relaxed text-justify w-full">
                  <p className="font-bold mb-2 uppercase tracking-wide text-slate-400">Hoja de Aviso de Inteligencia Artificial (AI Act Compliance)</p>
                  <p className="mb-2">
                      Este documento ha sido generado mediante sistemas de Inteligencia Artificial Generativa (JUXA Core v2.4). 
                      Conforme a las mejores prácticas regulatorias de la Unión Europea (EU AI Act) y estándares éticos internacionales:
                  </p>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                      <li>El contenido constituye un <strong>borrador auxiliar</strong> y no sustituye el criterio jurídico humano.</li>
                      <li>La <strong>Ratio Decidendi</strong> y fundamentación deben ser validadas por un profesional del derecho cualificado.</li>
                      <li>El sistema puede presentar alucinaciones en citas jurisprudenciales o hechos no contenidos en el expediente fuente.</li>
                  </ul>
              </div>
          </div>
      </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#050505] text-slate-400 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"><span className="text-xl">⚖️</span></div>
        </div>
        <p className="animate-pulse font-medium text-emerald-500">Redactando sentencia de alta precisión...</p>
      </div>
    );
  }

  // Show welcome screen if no data AND no saved draft
  if (!data && !editableText) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#050505] text-slate-500">
         <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-bold text-center mb-2 tracking-tighter text-white">
              EL FUTURO <br/>
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-600">DEL DERECHO.</span>
            </h1>
         </div>
        <p className="max-w-md text-center text-sm text-slate-400">
          Análisis jurídico de alta precisión con inteligencia artificial.
        </p>
      </div>
    );
  }

  // --- RENDER CONTENT ---
  return (
    <div className="flex flex-col h-full bg-[#050505] relative">
      
      {/* TOOLBAR */}
      <div className="bg-[#0f0f11]/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex flex-col md:flex-row justify-between items-center z-20 sticky top-0 transition-all">
        <div className="flex items-center space-x-3">
            {data?.matterDetected && (
                <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${getMatterColor(data.matterDetected)}`}>
                    {data.matterDetected}
                </span>
            )}
            
            {/* View Modes */}
            <div className="flex items-center bg-slate-900/50 rounded-lg p-1 border border-white/5 ml-4">
               <button 
                 onClick={() => handleTabChange('project')}
                 className={`px-3 py-1 text-xs font-bold rounded-md flex items-center transition-all ${activeTab === 'project' ? 'bg-slate-700 text-white shadow-lg shadow-black/50' : 'text-slate-400 hover:text-white'}`}
               >
                 <FileDown className="w-3 h-3 mr-1.5" /> PROYECTO
               </button>
               <button 
                 onClick={() => handleTabChange('ratio')}
                 className={`px-3 py-1 text-xs font-bold rounded-md flex items-center transition-all ${activeTab === 'ratio' ? 'bg-amber-900/40 text-amber-300 shadow-lg shadow-amber-900/20' : 'text-slate-400 hover:text-white'}`}
               >
                 <Lightbulb className="w-3 h-3 mr-1.5" /> RATIO DECIDENDI
               </button>
               <button 
                 onClick={() => handleTabChange('semantic')}
                 className={`px-3 py-1 text-xs font-bold rounded-md flex items-center transition-all ${activeTab === 'semantic' ? 'bg-purple-900/40 text-purple-300 shadow-lg shadow-purple-900/20' : 'text-slate-400 hover:text-white'}`}
               >
                 <BookOpen className="w-3 h-3 mr-1.5" /> SEMÁNTICA
               </button>
               <button 
                 onClick={() => handleTabChange('analytics')}
                 className={`px-3 py-1 text-xs font-bold rounded-md flex items-center transition-all ${activeTab === 'analytics' ? 'bg-blue-900/40 text-blue-300 shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white'}`}
               >
                 <MessageSquare className="w-3 h-3 mr-1.5" /> ANALYTICS
               </button>
            </div>

            {/* Save Indicator */}
            <div className="flex items-center space-x-2 ml-4 px-3 py-1 bg-black/20 rounded-full border border-white/5">
                {saveStatus === 'saving' ? (
                    <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
                ) : saveStatus === 'saved' ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                )}
                <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">
                    {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? 'Guardado' : 'Sin guardar'}
                </span>
            </div>
        </div>

        <div className="flex items-center space-x-3">
            {uploadedFile && (
                <button 
                  onClick={() => setShowPdfSplit(!showPdfSplit)}
                  className={`p-2 rounded-lg transition-all flex items-center text-sm ${showPdfSplit ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:bg-white/5'}`}
                  title="Cotejar con Expediente (Pantalla Dividida)"
                >
                  <SplitSquareHorizontal className="w-4 h-4" />
                </button>
            )}

            <div className="h-6 w-px bg-white/10 mx-1"></div>

            <button 
              onClick={handleManualSave}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title="Guardar Manualmente"
            >
              <Save className="w-4 h-4" />
            </button>

            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg transition-all text-xs font-bold uppercase tracking-wider border ${isEditing ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
              title={isEditing ? "Volver a Vista Paginada" : "Modo Edición"}
            >
              {isEditing ? <Type className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
              <span>{isEditing ? 'Vista Lectura' : 'Editor'}</span>
            </button>
            
            <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Copiar Texto">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            
            <button onClick={handleDownloadPdf} className="p-2 text-red-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Descargar PDF">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={handleDownloadWord} className="p-2 text-blue-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Descargar Word">
              <FileDown className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: DOCUMENT (Or full width if no split) */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 relative ${activeTab === 'project' ? '' : 'hidden'}`}>
           
           {/* EDIT MODE (TYPEWRITER STYLE) */}
           {isEditing ? (
             <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0a0a]">
                 <div className="max-w-4xl mx-auto bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] min-h-[1100px] relative">
                     {/* Decorative Header Bar */}
                     <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                     
                     {/* Paper Texture/Watermark Effect */}
                     <div className="absolute top-8 right-8 pointer-events-none opacity-[0.03]">
                         <Scale className="w-32 h-32 text-black" />
                     </div>

                     <textarea 
                       ref={textareaRef}
                       value={editableText}
                       onChange={(e) => setEditableText(e.target.value)}
                       onSelect={handleTextSelect}
                       className="w-full h-full min-h-[1100px] p-12 md:p-16 bg-transparent text-slate-900 font-serif text-lg leading-loose outline-none resize-none selection:bg-indigo-100 selection:text-indigo-900 pb-32 text-justify"
                       spellCheck={false}
                       placeholder="Comienza a escribir o selecciona texto para usar la IA..."
                     />
                     
                     <div className="px-16 pb-16">
                        <DisclaimerFooter />
                     </div>

                     {/* Floating Magic Button Hint */}
                     {!showSmartEditDialog && selectionRange && (
                         <div className="absolute bottom-8 right-8 animate-bounce">
                             <div className="bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center text-xs font-bold cursor-pointer hover:bg-indigo-500 transition-colors" onClick={() => setShowSmartEditDialog(true)}>
                                 <Sparkles className="w-4 h-4 mr-2" />
                                 IA Mágica Disponible
                             </div>
                         </div>
                     )}
                 </div>
                 
                 {/* SMART EDIT DIALOG (GLASSMORPHISM) */}
                 {showSmartEditDialog && selectionRange && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => {setShowSmartEditDialog(false); setSelectionRange(null);}}></div>
                        
                        <div className="relative w-full max-w-2xl bg-[#121214]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in-up ring-1 ring-white/10 flex flex-col max-h-[90vh]">
                            {isSmartEditLoading ? (
                                <div className="flex flex-col items-center justify-center p-16 space-y-6">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                                        <Wand2 className="w-16 h-16 text-indigo-400 animate-spin-slow relative z-10" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-white mb-1">Procesando Solicitud</h3>
                                        <p className="text-slate-400 text-sm">El motor jurídico está redactando...</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Header */}
                                    <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-5 border-b border-white/10 flex justify-between items-center">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                                                <Sparkles className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Edición Mágica 2.0</h3>
                                                <p className="text-[10px] text-indigo-300">Powered by JUXA Intelligence</p>
                                            </div>
                                        </div>
                                        <button onClick={() => {setShowSmartEditDialog(false); setSelectionRange(null);}} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    
                                    <div className="p-6 space-y-6 overflow-y-auto">
                                        {/* Selection Preview */}
                                        <div className="space-y-2">
                                            <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                <Quote className="w-3 h-3 mr-2" /> Contexto Seleccionado
                                            </div>
                                            <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-slate-300 text-sm italic font-serif border-l-2 border-l-indigo-500/50 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-10"><Quote className="w-8 h-8"/></div>
                                                <p className="line-clamp-4 leading-relaxed">"{selectedText}"</p>
                                            </div>
                                        </div>

                                        {/* Advanced Input Area */}
                                        <div className="space-y-2">
                                            <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                <Edit3 className="w-3 h-3 mr-2" /> Instrucción
                                            </div>
                                            <div className="relative group">
                                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl opacity-20 group-focus-within:opacity-60 transition duration-500 blur"></div>
                                                <div className="relative bg-[#0a0a0a] rounded-xl border border-white/10 group-focus-within:border-white/20 transition-colors">
                                                    <textarea
                                                        value={smartEditInput}
                                                        onChange={(e) => setSmartEditInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                executeSmartEdit(smartEditInput);
                                                            }
                                                        }}
                                                        placeholder="Ej: 'Reescribe este párrafo citando el artículo 1391 del Código de Comercio y hazlo más contundente...'"
                                                        className="w-full bg-transparent border-none rounded-xl px-5 py-4 text-sm text-white focus:ring-0 outline-none resize-none h-32 placeholder:text-slate-600 leading-relaxed"
                                                        autoFocus
                                                    />
                                                    
                                                    <div className="absolute bottom-3 right-3 flex items-center space-x-3">
                                                        <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">Press Enter to execute</span>
                                                        <button 
                                                            onClick={() => executeSmartEdit(smartEditInput)}
                                                            disabled={!smartEditInput.trim()}
                                                            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-900/40 hover:scale-105 active:scale-95"
                                                        >
                                                            <ArrowRight className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Chips */}
                                        <div className="pt-2">
                                            <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">
                                                <Sparkles className="w-3 h-3 mr-2" /> Sugerencias Rápidas
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={() => executeSmartEdit("Hazlo más formal, usa latinismos y lenguaje jurídico elevado")} className="px-4 py-3 bg-[#1a1a1d] hover:bg-[#252529] border border-white/5 hover:border-indigo-500/30 rounded-xl text-xs text-slate-300 transition-all flex items-center group text-left">
                                                    <span className="text-lg mr-3 group-hover:scale-110 transition-transform">🎩</span> 
                                                    <div>
                                                        <span className="font-bold block text-white group-hover:text-indigo-400">Formalizar</span>
                                                        <span className="text-[10px] opacity-60">Elevar nivel técnico</span>
                                                    </div>
                                                </button>
                                                <button onClick={() => executeSmartEdit("Extiende este argumento detallando más la fundamentación")} className="px-4 py-3 bg-[#1a1a1d] hover:bg-[#252529] border border-white/5 hover:border-blue-500/30 rounded-xl text-xs text-slate-300 transition-all flex items-center group text-left">
                                                    <span className="text-lg mr-3 group-hover:scale-110 transition-transform">📝</span>
                                                    <div>
                                                        <span className="font-bold block text-white group-hover:text-blue-400">Extender</span>
                                                        <span className="text-[10px] opacity-60">Añadir detalle y fondo</span>
                                                    </div>
                                                </button>
                                                <button onClick={() => executeSmartEdit("Sintetiza manteniendo los puntos resolutivos clave")} className="px-4 py-3 bg-[#1a1a1d] hover:bg-[#252529] border border-white/5 hover:border-amber-500/30 rounded-xl text-xs text-slate-300 transition-all flex items-center group text-left">
                                                    <span className="text-lg mr-3 group-hover:scale-110 transition-transform">✂️</span>
                                                    <div>
                                                        <span className="font-bold block text-white group-hover:text-amber-400">Resumir</span>
                                                        <span className="text-[10px] opacity-60">Concretar ideas</span>
                                                    </div>
                                                </button>
                                                <button onClick={() => executeSmartEdit("Corrige gramática y ortografía sin cambiar el sentido")} className="px-4 py-3 bg-[#1a1a1d] hover:bg-[#252529] border border-white/5 hover:border-emerald-500/30 rounded-xl text-xs text-slate-300 transition-all flex items-center group text-left">
                                                    <span className="text-lg mr-3 group-hover:scale-110 transition-transform">✅</span>
                                                    <div>
                                                        <span className="font-bold block text-white group-hover:text-emerald-400">Corregir</span>
                                                        <span className="text-[10px] opacity-60">Limpiar redacción</span>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                 )}
             </div>
           ) : (
             /* READ MODE (Paginated) */
             <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0a0a]">
                <div className="max-w-4xl mx-auto bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] min-h-[1100px] p-12 md:p-16 relative">
                     <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                         <img src="https://upload.wikimedia.org/wikipedia/commons/5/50/Escudo_Nacional_Mexicano_V2.svg" className="w-24 h-24" alt="Escudo" />
                     </div>
                     <div className="absolute top-8 left-12 text-[10px] text-slate-400 font-mono">PÁGINA {currentPage + 1} / {pages.length}</div>
                    
                    <article className="prose prose-slate max-w-none font-serif text-slate-900 leading-relaxed text-justify prose-headings:text-center prose-headings:font-bold prose-headings:uppercase prose-p:my-4">
                        <ReactMarkdown 
                          components={{
                            h1: ({node, ...props}) => <h1 className="mt-8 mb-6 text-xl tracking-wide text-slate-900 border-b-2 border-slate-900 pb-2 inline-block mx-auto" {...props} />,
                            h2: ({node, ...props}) => <h2 className="mt-8 mb-4 text-lg font-bold text-slate-800" {...props} />,
                          }}
                        >
                            {pages[currentPage] || ""}
                        </ReactMarkdown>
                    </article>

                    {currentPage === pages.length - 1 && (
                      <div className="mt-24 flex flex-col items-center text-center space-y-12">
                          <div className="w-64 border-t border-slate-900 pt-2"><p className="font-bold text-sm">LIC. JUEZ DE PRIMERA INSTANCIA</p></div>
                          <DisclaimerFooter />
                          <div className="text-xs text-slate-400">FIN DEL DOCUMENTO</div>
                      </div>
                    )}
                </div>
                
                {/* Pagination Controls Floating */}
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full border border-white/10 shadow-xl z-30">
                     <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} className="text-white disabled:opacity-30"><ChevronLeft className="w-5 h-5"/></button>
                     <span className="text-xs font-mono text-white">{currentPage + 1} / {pages.length}</span>
                     <button onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))} disabled={currentPage === pages.length - 1} className="text-white disabled:opacity-30"><ChevronRight className="w-5 h-5"/></button>
                </div>
             </div>
           )}
        </div>

        {/* RATIO DECIDENDI TAB CONTENT */}
        {activeTab === 'ratio' && (
             <div className="flex-1 bg-[#0a0a0a] p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white flex items-center mb-2">
                            <Lightbulb className="w-6 h-6 mr-3 text-amber-500" />
                            Ratio Decidendi
                        </h2>
                        <p className="text-slate-400 text-sm">
                            Análisis del razonamiento nuclear y sustento lógico de la resolución.
                        </p>
                    </div>

                    <div className="bg-[#151517] border border-white/10 rounded-xl p-8 relative overflow-hidden mb-8">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                        <div className="prose prose-invert prose-lg max-w-none text-slate-300 font-serif leading-loose text-justify">
                            {data?.ratioDecidendi ? (
                                <ReactMarkdown>{data.ratioDecidendi}</ReactMarkdown>
                            ) : (
                                <div className="text-center py-12 text-slate-500 italic">
                                    No se ha generado el análisis de Ratio Decidendi para este documento.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Disclaimer at the bottom of Ratio tab as well */}
                    <div className="bg-[#151517] border border-white/10 rounded-xl p-6">
                        <DisclaimerFooter />
                    </div>
                </div>
             </div>
        )}

        {/* SEMANTIC MODE TAB CONTENT */}
        {activeTab === 'semantic' && (
             <div className="flex-1 bg-[#0a0a0a] p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white flex items-center mb-2">
                            <BookOpen className="w-6 h-6 mr-3 text-purple-500" />
                            Análisis Semántico & Legislativo
                        </h2>
                        <p className="text-slate-400 text-sm">
                            JUXA escanea el documento para identificar la fundamentación jurídica y explicar su aplicabilidad.
                        </p>
                    </div>

                    {isSemanticLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-40 bg-[#151517] rounded-xl animate-pulse border border-white/5"></div>
                            ))}
                        </div>
                    ) : semanticData?.citations && semanticData.citations.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                            {semanticData.citations.map((item, idx) => (
                                <div key={idx} className="bg-[#151517] border border-white/10 rounded-xl p-6 hover:border-purple-500/50 transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-purple-900/20 rounded-lg text-purple-400">
                                                <Scale className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-lg">{item.article}</h4>
                                                <span className="text-xs text-slate-400 uppercase tracking-wider">{item.law}</span>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                            item.relevance === 'alta' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900' :
                                            item.relevance === 'media' ? 'bg-amber-900/20 text-amber-400 border-amber-900' :
                                            'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                            Relevancia {item.relevance}
                                        </span>
                                    </div>
                                    <div className="pl-12">
                                        <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-purple-900/50 pl-4">
                                            {item.application}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-[#151517] rounded-xl border border-white/10 border-dashed">
                             <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                             <p className="text-slate-400">No se encontraron citas legislativas o el análisis no se pudo completar.</p>
                             <button onClick={() => handleTabChange('semantic')} className="mt-4 text-purple-400 hover:text-purple-300 text-sm font-bold">Reintentar Análisis</button>
                        </div>
                    )}
                </div>
             </div>
        )}

        {/* ANALYTICS PANEL (Overlay or Tab) */}
        {activeTab === 'analytics' && (
           <div className="flex-1 bg-[#0a0a0a] flex flex-col p-4 md:p-6 overflow-hidden animate-fade-in">
              <div className="flex-1 bg-[#0f0f11] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">
                 <div className="p-4 border-b border-white/10 bg-[#151517] flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-blue-500"/> JUXA Assistant</h3>
                    <button 
                      onClick={() => handleSendMessage('analysis')} 
                      className="text-xs bg-red-900/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-900/50 flex items-center hover:bg-red-900/40 transition-colors"
                      disabled={isChatLoading}
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" /> Buscar Contradicciones
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.length === 0 && (
                        <div className="text-center text-slate-500 mt-20">
                            <p className="text-sm">Dialoga con la sentencia o solicita un análisis de riesgos.</p>
                        </div>
                    )}
                    {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-[#1a1a1d] text-slate-200 border border-white/10 rounded-tl-none'
                            }`}>
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex justify-start">
                             <div className="bg-[#1a1a1d] p-4 rounded-2xl rounded-tl-none border border-white/10">
                                 <div className="flex space-x-1">
                                     <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                                     <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></div>
                                     <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></div>
                                 </div>
                             </div>
                        </div>
                    )}
                 </div>

                 <div className="p-4 bg-[#151517] border-t border-white/10">
                    <div className="flex items-center space-x-2">
                        <input 
                          type="text" 
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage('chat')}
                          placeholder="Escribe una instrucción para modificar el proyecto..."
                          className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                        />
                        <button 
                           onClick={() => handleSendMessage('chat')}
                           disabled={isChatLoading || !chatInput}
                           className="bg-blue-600 p-3 rounded-xl text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                           <Send className="w-4 h-4" />
                        </button>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* RIGHT SPLIT PANEL: PDF VIEWER (If Enabled) */}
        {showPdfSplit && uploadedFile && activeTab === 'project' && (
            <div className="w-1/2 border-l border-white/10 bg-[#151517] flex flex-col shadow-2xl z-30 relative animate-fade-in-right">
                <div className="bg-[#0f0f11] border-b border-white/10 p-2 flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest px-4">
                    <span>Expediente de Referencia</span>
                    <button onClick={() => setShowPdfSplit(false)} className="hover:text-white"><X className="w-4 h-4"/></button>
                </div>
                <div className="flex-1 relative">
                    <iframe 
                        src={URL.createObjectURL(uploadedFile)} 
                        className="w-full h-full absolute inset-0"
                        title="PDF Viewer"
                    />
                </div>
            </div>
        )}

      </div>
    </div>
  );
};