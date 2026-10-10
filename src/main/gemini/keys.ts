/**
 * Aide à l'affichage sûr des clés API : ne révèle jamais la clé complète.
 * Format « AIza…w3xT » : 4 premiers + 4 derniers caractères, le reste masqué.
 */
export function maskApiKey(apiKey: string): string {
  const key = apiKey.trim()
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}