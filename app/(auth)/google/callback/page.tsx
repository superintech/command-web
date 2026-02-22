'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { authApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      toast({
        title: 'Google Login Failed',
        description: error,
        variant: 'destructive',
      });
      router.replace('/login');
      return;
    }

    if (!accessToken || !refreshToken) {
      toast({
        title: 'Google Login Failed',
        description: 'Missing authentication tokens',
        variant: 'destructive',
      });
      router.replace('/login');
      return;
    }

    authApi.me(accessToken).then((response) => {
      if (response.success && response.data) {
        setAuth(response.data, accessToken, refreshToken);
        toast({
          title: 'Welcome!',
          description: 'You have successfully logged in with Google.',
        });
        router.replace('/dashboard');
      } else {
        toast({
          title: 'Google Login Failed',
          description: 'Could not fetch user profile',
          variant: 'destructive',
        });
        router.replace('/login');
      }
    }).catch(() => {
      toast({
        title: 'Google Login Failed',
        description: 'Authentication error',
        variant: 'destructive',
      });
      router.replace('/login');
    });
  }, [searchParams, setAuth, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-sky-50 to-primary/10">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-gray-500">Completing Google sign-in...</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-sky-50 to-primary/10">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
