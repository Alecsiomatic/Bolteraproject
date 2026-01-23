import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useVenue(venueId?: string) {
  return useQuery({
    queryKey: ["venue", venueId],
    queryFn: () => {
      if (!venueId) throw new Error("venueId is required");
      return api.getVenue(venueId);
    },
    enabled: Boolean(venueId),
    staleTime: 1000 * 60,
  });
}
