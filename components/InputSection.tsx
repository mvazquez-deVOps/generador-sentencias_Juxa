import React, { useState } from 'react';
import { FileText, AlertCircle, Wand2, Paperclip } from 'lucide-react';

interface InputSectionProps {
  onGenerate: (notes: string, file: File | null) => void;
  onFileSelect: (file: File | null) => void;
  isLoading: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ onGenerate, onFileSelect, isLoading }) => {
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      onFileSelect(selectedFile);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(notes, file);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] border-r border-white/10">
      <div className="p-6 border-b border-white/10">
        <h2 className="text-lg font-medium text-white flex items-center">
          <FileText className="w-5 h-5 mr-2 text-blue-500" />
          Nueva Consulta
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Carga el expediente y define los parámetros.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* File Upload */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-3 flex justify-between items-center">
            <span>Expediente Digital (PDF)</span>
          </label>
          <div className={`group border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden ${file ? 'bg-blue-900/10 border-blue-500/50' : 'border-slate-700 bg-white/5 hover:bg-white/10 hover:border-blue-500/50'}`}>
            <input 
              type="file" 
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isLoading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            
            {file ? (
              <div className="flex flex-col items-center animate-fade-in w-full z-20">
                <div className="p-3 bg-emerald-500/20 rounded-full mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <FileText className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="font-medium text-white text-sm break-all line-clamp-1 px-4">{file.name}</span>
                <span className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            ) : (
              <>
                <div className="p-3 bg-slate-800 rounded-full mb-3 group-hover:bg-blue-500/20 transition-colors">
                  <Paperclip className="w-6 h-6 text-slate-400 group-hover:text-blue-400" />
                </div>
                <p className="text-sm text-slate-300 font-medium">Adjunta un documento</p>
                <p className="text-xs text-slate-500 mt-1">PDF hasta 50MB</p>
              </>
            )}
          </div>
        </div>

        {/* Notes Input */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
            Notas del Juzgador / Hechos
          </label>
          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe los hechos relevantes, el sentido del fallo deseado o cualquier observación específica..."
              className="w-full h-64 p-4 bg-[#0f0f11] border border-slate-800 rounded-xl text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none font-mono placeholder:text-slate-600"
            />
            <div className="absolute bottom-3 right-3">
              <AlertCircle className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            La IA analizará el PDF adjunto priorizando estas instrucciones.
          </p>
        </div>
      </div>

      <div className="p-6 border-t border-white/10 bg-[#0a0a0a]">
        <button
          onClick={handleSubmit}
          disabled={isLoading} 
          className={`w-full py-4 px-4 rounded-xl flex items-center justify-center font-bold text-white transition-all shadow-lg
            ${isLoading
              ? 'bg-slate-800 cursor-not-allowed text-slate-500' 
              : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20 active:scale-[0.98]'}`}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white mr-3"></div>
              Procesando con JUXA AI...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5 mr-2" />
              Generar Proyecto
            </>
          )}
        </button>
      </div>
    </div>
  );
};