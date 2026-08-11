import {
  PermissionRuleError,
  listPermissionRules,
  getPermissionRule,
  getPermissionRuleByRole,
  updatePermissionRule,
} from "../services/permissionRuleService.js";

function handleError(res, next, error) {
  if (error instanceof PermissionRuleError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

export async function list(req, res, next) {
  try {
    const items = await listPermissionRules();
    return res.json(items);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getById(req, res, next) {
  try {
    const item = await getPermissionRule(req.params.id);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function getByRole(req, res, next) {
  try {
    const item = await getPermissionRuleByRole(req.params.role);
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function update(req, res, next) {
  try {
    const item = await updatePermissionRule(req.params.id, req.body || {});
    return res.json(item);
  } catch (error) {
    return handleError(res, next, error);
  }
}
