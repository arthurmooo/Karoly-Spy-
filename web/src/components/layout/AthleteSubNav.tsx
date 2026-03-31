import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { SlidingTabs, type SlidingTabItem } from "@/components/ui/SlidingTabs";

interface AthleteSubNavProps {
  athleteId: string;
}

type TabKey = "bilan" | "profile" | "trends";

export function AthleteSubNav({ athleteId }: AthleteSubNavProps) {
  const location = useLocation();

  const active: TabKey = useMemo(() => {
    if (location.pathname.endsWith("/profile")) return "profile";
    if (location.pathname.endsWith("/trends")) return "trends";
    return "bilan";
  }, [location.pathname]);

  const tabs: SlidingTabItem<TabKey>[] = useMemo(() => [
    {
      key: "bilan",
      label: "Bilan",
      icon: <Icon name="bar_chart" className="text-sm" />,
      href: `/athletes/${athleteId}/bilan`,
    },
    {
      key: "profile",
      label: "Profil",
      icon: <Icon name="person" className="text-sm" />,
      href: `/athletes/${athleteId}/profile`,
    },
    {
      key: "trends",
      label: "Santé & HRV",
      icon: <Icon name="monitor_heart" className="text-sm" />,
      href: `/athletes/${athleteId}/trends`,
    },
  ], [athleteId]);

  return <SlidingTabs items={tabs} value={active} />;
}
