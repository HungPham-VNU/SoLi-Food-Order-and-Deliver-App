import { Link } from 'react-router-dom';
import { LoginForm } from '@/features/auth/components/login/LoginForm';
import { LoginAlternativeMethods } from '@/features/auth/components/login/LoginAlternativeMethods';
import { LoginFooter } from '@/features/auth/components/login/LoginFooter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';

export function LoginPage() {
  return (
    <main className="pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-screen">
      <Card className="p-4 space-y-4">
        <div className="text-center space-y-2">
          <CardHeader className="font-headline text-2xl font-extrabold text-on-surface">
            Login
          </CardHeader>
          <CardDescription className="font-body text-sm text-on-surface-variant">
            Please authenticate to continue to your workspace.
          </CardDescription>
        </div>
        <CardContent className="space-y-4">
          <LoginForm />
          <LoginAlternativeMethods />

          <div className="pt-4 border-t text-center text-sm text-on-surface-variant">
            New to UITFood?{' '}
            <Link
              to="/auth/register"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </div>
        </CardContent>

        <LoginFooter />
      </Card>
    </main>
  );
}
