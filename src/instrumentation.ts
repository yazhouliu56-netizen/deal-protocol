export async function register() {
  try {
    const { syncBuiltinsToDb } = await import("./lib/protocol/bootstrap")
    await syncBuiltinsToDb()
  } catch { /* non-blocking */ }

  try {
    const { startAutoTransitions } = await import("./lib/auto-transitions")
    startAutoTransitions()
  } catch { /* non-blocking */ }
}
