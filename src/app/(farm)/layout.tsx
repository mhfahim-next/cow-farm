import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { FarmShell } from '@/components/farm/shell';
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await cookies()).get('farm_session')?.value) redirect('/login');
  return <FarmShell>{children}</FarmShell>;
}
