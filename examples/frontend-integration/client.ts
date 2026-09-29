import { createAuthClient } from '../../src/client-sdk.ts';

export const auth = createAuthClient();

export const signUp = (name: string, email: string, password: string) =>
  auth.signUp.email({ name, email, password, callbackURL: '/login?verified=1' });

export const signIn = (email: string, password: string) =>
  auth.signIn.email({ email, password });

export const signInSocial = (provider: 'google' | 'github') =>
  auth.signIn.social({ provider, callbackURL: '/app' });

export const requestReset = (email: string) =>
  auth.requestPasswordReset({ email, redirectTo: '/reset-password' });

export const resetPassword = (token: string, newPassword: string) =>
  auth.resetPassword({ token, newPassword });
