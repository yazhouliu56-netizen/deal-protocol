import { getBrowserSupabase } from "@/lib/supabase-browser"

export async function uploadPhotoWithRetry(
  file: File,
  demandId: string,
  retries = 3,
): Promise<string> {
  const filePath = `${demandId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split(".").pop()}`

  for (let i = 0; i < retries; i++) {
    try {
      const supabase = getBrowserSupabase()
      const { error } = await supabase.storage
        .from("certificates")
        .upload(filePath, file, { cacheControl: "3600", upsert: true })

      if (error) throw error

      const {
        data: { publicUrl },
      } = supabase.storage.from("certificates").getPublicUrl(filePath)

      return publicUrl
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise((res) => setTimeout(res, Math.pow(2, i) * 1000))
    }
  }

  throw new Error("Upload failed after all retries")
}
