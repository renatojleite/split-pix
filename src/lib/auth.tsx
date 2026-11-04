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
