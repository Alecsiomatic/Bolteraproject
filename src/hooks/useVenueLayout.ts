import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useVenueLayout(venueId?: string, layoutId?: string) {
  return useQuery({
    queryKey: ["venue-layout", venueId, layoutId],
    queryFn: () => {
      if (!venueId || !layoutId) {
        throw new Error("venueId and layoutId are required");
      }
      return api.getVenueLayout(venueId, layoutId);
    },
    enabled: Boolean(venueId && layoutId),
    staleTime: 1000 * 60,
  });
}
