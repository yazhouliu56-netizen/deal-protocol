export function isPlaceholderUrl(url: string | undefined): boolean {
  if (!url) return true
  return url.includes("your-project-id") || url.includes("placeholder")
}
