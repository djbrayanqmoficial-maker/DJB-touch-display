/**
 * DJB Core — Analyzer Engine Contract
 * Base architecture for BPM detection, Beatgrid alignment, and Musical Key (Camelot) detection.
 */

export interface AnalysisConfig {
  bpmRangeMin: number;
  bpmRangeMax: number;
  keyNotation: 'CAMELOT' | 'OPEN_KEY' | 'STANDARD_MUSICAL';
  analyzeOnLoad: boolean;
  multiThreadWorkerCount: 1 | 2 | 4;
}

export const INITIAL_ANALYSIS_CONFIG: AnalysisConfig = {
  bpmRangeMin: 78,
  bpmRangeMax: 155,
  keyNotation: 'CAMELOT',
  analyzeOnLoad: true,
  multiThreadWorkerCount: 2,
};
