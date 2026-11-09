import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ session, loading: false }),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('useUserId fora de uma tela autenticada');
  return session.user.id;
}

/** Para onde o link do e-mail leva de volta (precisa estar nas Redirect URLs do Supabase). */
export const AUTH_REDIRECT = 'splitpix://login-callback';

/**
 * Manda o e-mail de acesso. O e-mail padrão do Supabase traz um link (abre o app
 * já logado via AUTH_REDIRECT); com SMTP próprio e o modelo usando {{ .Token }},
 * traz também o código de 6 dígitos.
 */
export async function sendCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: AUTH_REDIRECT },
  });
  if (error) throw error;
}

/** Entra com e-mail e senha (sem envio de e-mail). */
export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
}

/**
 * Cria a conta com e-mail e senha. Com "Confirm email" desligado no Supabase,
 * já volta logado; se vier sem sessão, a confirmação por e-mail ainda está ligada.
 */
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  if (!data.session) {
    // E-mail já cadastrado (o Supabase não revela) ou confirmação por e-mail ligada.
    throw new Error('Esse e-mail já tem conta. Use "Entrar" com a sua senha.');
  }
}

/** Define ou troca a senha de quem já está logado (não manda e-mail). */
export async function setPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Lê a sessão do link do e-mail (#access_token=…, ?code=… ou ?token_hash=…). */
export async function sessionFromUrl(url: string): Promise<boolean> {
  const params = new URLSearchParams();
  const [, query = ''] = url.split('?');
  const [, hash = ''] = url.split('#');
  for (const part of [query.split('#')[0], hash]) {
    new URLSearchParams(part).forEach((v, k) => params.set(k, v));
  }
  const fail = params.get('error_description') ?? params.get('error');
  if (fail) {
    throw new Error(/expired|invalid/i.test(fail) ? 'Link expirado ou já usado. Peça outro.' : fail.replace(/\+/g, ' '));
  }
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (access && refresh) {
    const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw error;
    return true;
  }
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  const tokenHash = params.get('token_hash');
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error) throw error;
    return true;
  }
  return false;
}

export async function verifyCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'email',
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Mensagens do login (Supabase Auth) em português. */
export function authError(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : '';
  if (/rate limit|too many|over_email_send_rate/i.test(m)) {
    return 'Muitos códigos pedidos em pouco tempo. Use o último código que chegou no seu e-mail ou tente de novo em alguns minutos.';
  }
  if (/expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(m)) return 'Código inválido ou vencido. Peça um novo.';
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos. Se sua conta é antiga (entrava por código), defina a senha primeiro — veja abaixo.';
  if (/password.*(at least|short|6)/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/already registered|already exists/i.test(m)) return 'Esse e-mail já tem conta. Use "Entrar" com a sua senha.';
  if (/same.*password|different from the old/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  if (/fetch|network/i.test(m)) return 'Sem conexão. Tente de novo.';
  if (/invalid.*email|email.*invalid/i.test(m)) return 'E-mail inválido.';
  return m || fallback;
}
