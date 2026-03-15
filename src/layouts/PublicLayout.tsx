import { Outlet } from 'react-router-dom';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { FloatingPlayer } from '@/components/public/FloatingPlayer';

export function PublicLayout() {
  return (
    <div className="min-h-screen pb-28">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-4 py-6"><Outlet /></main>
      <PublicFooter />
      <FloatingPlayer />
    </div>
  );
}
