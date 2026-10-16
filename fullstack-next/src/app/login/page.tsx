import { Suspense } from 'react';

import { LoginScreen } from '@/features/auth';

/**
 * Экран входа. `LoginScreen` читает `?authError=1` через `useSearchParams`,
 * поэтому под `cacheComponents` он обязан стоять за `<Suspense>`.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
