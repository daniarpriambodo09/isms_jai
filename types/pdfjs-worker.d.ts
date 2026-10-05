// pdf.js ships no types for its worker module (lib/pdfjs-loader.ts bundles it for older browsers).
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown
}
