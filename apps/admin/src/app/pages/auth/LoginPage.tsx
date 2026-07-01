import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useSignIn } from '@/features/auth/hooks/useSignIn';
import { ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const {
    signInWithEmail,
    isPending: isSigningIn,
    error: signInError,
  } = useSignIn();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">
          progress_activity
        </span>
      </div>
    );
  }

  if ((session?.user as any)?.role === 'admin') {
    return <Navigate to="/restaurants" replace />;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    void signInWithEmail({ email: email.trim(), password });
  }

  const errorMessage =
    signInError instanceof ApiError
      ? signInError.message
      : signInError
        ? 'Sign-in failed. Check your credentials.'
        : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-container-low px-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-200">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-on-surface font-headline">
              UITFood Admin
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Sign in to manage the platform
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSigningIn}>
              {isSigningIn ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Not an admin?{' '}
            <a
              href="http://localhost:5173/auth/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Restaurant portal
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
