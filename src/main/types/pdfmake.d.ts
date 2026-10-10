/**
 * Déclarations minimales pour pdfmake (0.3.x) qui ne fournit pas de typages.
 * Seule la surface utilisée par ExportService est décrite.
 */

declare module 'pdfmake' {
  export interface OutputDocument {
    getBuffer(): Promise<Buffer>
    getBase64(): Promise<string>
    write(filename: string): Promise<void>
  }

  export interface PdfMakeApi {
    setFonts(fonts: Record<string, unknown>): void
    addFonts(fonts: Record<string, unknown>): void
    setUrlAccessPolicy(callback: (url: string) => boolean): void
    setLocalAccessPolicy(callback: (path: string) => boolean): void
    createPdf(docDefinition: Record<string, unknown>, options?: Record<string, unknown>): OutputDocument
  }

  const pdfmake: PdfMakeApi
  export default pdfmake
}

declare module 'pdfmake/fonts/Roboto.js' {
  const fonts: Record<string, unknown>
  export default fonts
}