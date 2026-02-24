
export interface SentenceRequest {
  caseFile?: File;
  judgeNotes: string;
}

export interface SentenceResponse {
  text: string;
  ratioDecidendi: string;
  matterDetected: string;
}

export enum LegalMatter {
  PENAL = 'PENAL',
  CIVIL = 'CIVIL',
  MERCANTIL = 'MERCANTIL',
  FAMILIAR = 'FAMILIAR',
  LABORAL = 'LABORAL',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  CONSTITUCIONAL = 'CONSTITUCIONAL',
  UNKNOWN = 'INDEFINIDO'
}

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  result: SentenceResponse | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface CitationAnalysis {
  article: string;
  law: string;
  application: string;
  relevance: 'alta' | 'media' | 'baja';
}

export interface SemanticAnalysisResult {
  citations: CitationAnalysis[];
}