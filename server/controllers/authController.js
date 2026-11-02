import { readRememberEntries, setRememberCookie } from "../lib/rememberMe.js";
import {
  AuthError,
  autoLogin,
  changePassword,
  deleteUser,
  googleClientId,
  inviteUser,
  listLoginEmails,
  listUsers,
  login,
  loginWithGoogle,
  rememberedSession,
  setUserPassword,
  updateMe,
  updateUser,
} from "../services/authService.js";

function handleError(res, next, error) {
  if (error instanceof AuthError) {
    const body = { message: error.message };
    if (error.code) body.code = error.code;
    return res.status(error.status).json(body);
  }
  return next(error);
}

function applyRememberCookie(res, entries) {
  if (entries) setRememberCookie(res, entries);
}

export async function loginEmails(_req, res, next) {
  try {
    return res.json(await listLoginEmails());
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function autoLoginHandler(req, res, next) {
  try {
    const result = await autoLogin({
      email: req.body?.email,
      entries: readRememberEntries(req),
    });
    applyRememberCookie(res, result.rememberCookie);
    return res.json({ token: result.token, user: result.user });
  } catch (error) {
    return handleError(res, next, error);
  }
}

export function googleClientIdHandler(_req, res) {
  return res.json(googleClientId());
}

export async function google(req, res, next) {
  try {
    const result = await loginWithGoogle({
      credential: req.body?.credential,
      rememberMe: req.body?.rememberMe,
      entries: readRememberEntries(req),
    });
    applyRememberCookie(res, result.rememberCookie);
    return res.json({ token: result.token, user: result.user });
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function rememberedSessionHandler(req, res, next) {
  try {
    const result = await rememberedSession({
      entries: readRememberEntries(req),
    });
    applyRememberCookie(res, result.rememberCookie);
    return res.json({ token: result.token, user: result.user });
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function loginHandler(req, res, next) {
  try {
    const result = await login({
      email: req.body?.email,
      password: req.body?.password,
      rememberMe: req.body?.rememberMe,
      entries: readRememberEntries(req),
    });
    applyRememberCookie(res, result.rememberCookie);
    return res.json({ token: result.token, user: result.user });
  } catch (error) {
    return handleError(res, next, error);
  }
}

export function logout(_req, res) {
  return res.json({ ok: true });
}

export function me(req, res) {
  return res.json(req.user);
}

export async function listUsersHandler(req, res, next) {
  try {
    return res.json(await listUsers(req.user));
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function invite(req, res, next) {
  try {
    const result = await inviteUser(req.user, req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function updateUserHandler(req, res, next) {
  try {
    const user = await updateUser(req.user, req.params.id, req.body || {});
    return res.json(user);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function deleteUserHandler(req, res, next) {
  try {
    await deleteUser(req.user, req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function setUserPasswordHandler(req, res, next) {
  try {
    const result = await setUserPassword(
      req.user,
      req.params.id,
      req.body?.password,
    );
    return res.json(result);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function updateMeHandler(req, res, next) {
  try {
    const user = await updateMe(req.user, req.body || {});
    return res.json(user);
  } catch (error) {
    return handleError(res, next, error);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const result = await changePassword(
      req.user,
      req.body?.current_password,
      req.body?.new_password,
    );
    return res.json(result);
  } catch (error) {
    return handleError(res, next, error);
  }
}
