import { useState } from "react";
import { cn } from "@/lib/cn";

const SIZE_CLASSES = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
  xl: "w-14 h-14 text-xl",
} as const;

type AvatarSize = keyof typeof SIZE_CLASSES;

interface AthleteAvatarProps {
  firstName?: string;
  lastName?: string;
  name?: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  shape?: "circle" | "rounded";
  className?: string;
}

function getInitials(firstName?: string, lastName?: string, name?: string): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }
  return "?";
}

function getAltText(firstName?: string, lastName?: string, name?: string): string {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  return name ?? "";
}

export function AthleteAvatar({
  firstName,
  lastName,
  name,
  avatarUrl,
  size = "md",
  shape = "circle",
  className,
}: AthleteAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showImage = avatarUrl && !imgError;
  const initials = getInitials(firstName, lastName, name);
  const alt = getAltText(firstName, lastName, name);
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-md";

  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt={alt}
        loading="lazy"
        onError={() => setImgError(true)}
        className={cn(
          SIZE_CLASSES[size],
          shapeClass,
          "object-cover shrink-0 border border-slate-200 dark:border-slate-700",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        SIZE_CLASSES[size],
        shapeClass,
        "flex items-center justify-center font-medium shrink-0",
        "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
        className,
      )}
    >
      {initials}
    </div>
  );
}
