import { useQueryClient } from "@tanstack/react-query";
import { showAlert } from "@/components/AppAlert";

/**
 * Optimistically patch one item in a list query, persist, revert on error.
 *
 * @param {{
 *   queryKey: unknown[],
 *   updateFn: (id: string, patch: Record<string, unknown>) => Promise<unknown>,
 *   fallbackMessage?: string,
 * }} options
 */
export function useOptimisticListItemUpdate({
  queryKey,
  updateFn,
  fallbackMessage = "שגיאה בשמירה. נסה שוב.",
}) {
  const queryClient = useQueryClient();

  /**
   * @param {string} id
   * @param {Record<string, unknown>} patch
   */
  return async function updateItem(id, patch) {
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, (current) => {
      if (!Array.isArray(current)) return current;
      return current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
    });
    try {
      await updateFn(id, patch);
    } catch (error) {
      queryClient.setQueryData(queryKey, previous);
      await showAlert(error?.message || fallbackMessage);
    }
  };
}
