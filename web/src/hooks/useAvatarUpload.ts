import { useState } from "react";
import { supabase } from "@/lib/supabase";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getExtension(file: File): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[file.type] ?? "jpg";
}

export function useAvatarUpload(athleteId: string | null) {
  const [isUploading, setIsUploading] = useState(false);

  async function uploadAvatar(file: File): Promise<string | null> {
    if (!athleteId) return null;

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Format non supporté. Utilisez JPG, PNG ou WebP.");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Fichier trop volumineux (max 2 Mo).");
    }

    setIsUploading(true);
    try {
      const ext = getExtension(file);
      const path = `${athleteId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      // Append cache-buster so browsers show the new image immediately
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("athletes")
        .update({ avatar_url: publicUrl })
        .eq("id", athleteId);

      if (updateError) throw updateError;

      return publicUrl;
    } finally {
      setIsUploading(false);
    }
  }

  async function removeAvatar(): Promise<void> {
    if (!athleteId) return;

    setIsUploading(true);
    try {
      // List files in athlete folder and remove them
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(athleteId);

      if (files && files.length > 0) {
        const paths = files.map((f) => `${athleteId}/${f.name}`);
        await supabase.storage.from("avatars").remove(paths);
      }

      await supabase
        .from("athletes")
        .update({ avatar_url: null })
        .eq("id", athleteId);
    } finally {
      setIsUploading(false);
    }
  }

  return { uploadAvatar, removeAvatar, isUploading };
}
