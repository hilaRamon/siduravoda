import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { permissionRuleApi } from "@/api/permissionRuleApi";

export const permissionRuleKeys = {
  all: ["permission-rules"],
  list: () => [...permissionRuleKeys.all, "list"],
  detail: (id) => [...permissionRuleKeys.all, "detail", id],
  byRole: (role) => [...permissionRuleKeys.all, "by-role", role],
};

export function usePermissionRules(options = {}) {
  return useQuery({
    queryKey: permissionRuleKeys.list(),
    queryFn: () => permissionRuleApi.list(),
    ...options,
  });
}

export function usePermissionRuleByRole(role, options = {}) {
  return useQuery({
    queryKey: permissionRuleKeys.byRole(role),
    queryFn: () => permissionRuleApi.getByRole(role),
    enabled: !!role,
    ...options,
  });
}

export function useUpdatePermissionRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => permissionRuleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionRuleKeys.all });
    },
  });
}
