import { Icon } from "@/components/ui/Icon";

interface SportChipProps {
  label: string;
  icon?: string;
  isActive: boolean;
  onClick: () => void;
}

export function SportChip({ label, icon, isActive, onClick }: SportChipProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
        isActive
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {icon && <Icon name={icon} className="text-[14px]" />}
      {label}
    </button>
  );
}
