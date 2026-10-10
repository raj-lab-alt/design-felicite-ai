import type { AnalysisProgressEvent, RedesignProgressEvent } from '@shared/ipc'

/** Pont de progression : les services émettent, le processus principal diffuse aux fenêtres. */
export interface ProgressHub {
  analysis(event: AnalysisProgressEvent): void
  redesign(event: RedesignProgressEvent): void
}

/** Aucune diffusion (tests, contexte sans fenêtre). */
export class NoopProgressHub implements ProgressHub {
  analysis(_event: AnalysisProgressEvent): void {}
  redesign(_event: RedesignProgressEvent): void {}
}