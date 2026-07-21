import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { normalizeAppSettings } from "@/lib/pricing";

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const settingsList = await base44.entities.AppSettings.list();
      return normalizeAppSettings(settingsList[0]);
    },
  });
}
