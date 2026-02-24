import React, { useState } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { DocumentPreview } from './components/DocumentPreview';
import { generateSentence } from './services/geminiService';
import { SentenceResponse, GenerationState } from './types';

function App() {
  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    error: null,
    result: null,
  });

  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleGenerate = async (notes: string, file: File | null) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response: SentenceResponse = await generateSentence({
        judgeNotes: notes,
        caseFile: file || undefined
      });
      
      setState({
        isLoading: false,
        error: null,
        result: response,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || "Ocurrió un error inesperado.",
      }));
    }
  };

  return (
    <div className="h-screen flex flex-col bg-black">
      <Header />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side: Inputs */}
        <div className="w-full md:w-1/3 min-w-[350px] max-w-md h-full z-10 shadow-2xl shadow-black">
          <InputSection 
            onGenerate={handleGenerate} 
            onFileSelect={setCurrentFile} 
            isLoading={state.isLoading} 
          />
        </div>

        {/* Right Side: Preview */}
        <div className="flex-1 h-full relative">
            {state.error && (
                <div className="absolute top-4 left-4 right-4 z-50 bg-red-900/90 border border-red-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center animate-fade-in backdrop-blur-sm">
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {state.error}
                    <button 
                        onClick={() => setState(prev => ({...prev, error: null}))}
                        className="ml-auto text-white/60 hover:text-white"
                    >
                        ✕
                    </button>
                </div>
            )}
            <DocumentPreview 
              data={state.result} 
              isLoading={state.isLoading} 
              uploadedFile={currentFile}
            />
        </div>
      </main>
      
      {/* Footer / Branding */}
      <div className="bg-[#050505] text-slate-600 text-[10px] p-2 text-center border-t border-white/5 uppercase tracking-widest font-bold">
        JX LABS | Todos los derechos reservados &copy; 2026
      </div>
    </div>
  );
}

export default App;
