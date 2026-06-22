import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { TopNavBar } from './TopNavBar';

export function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background">
      <div
        aria-hidden="true"
        className={`relative shrink-0 bg-transparent transition-[width] duration-200 ease-linear ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      />
      <div
        aria-hidden={!isSidebarOpen}
        inert={!isSidebarOpen}
        className={`fixed inset-y-0 left-0 z-20 h-svh w-64 transition-[translate] duration-200 ease-linear will-change-[translate] ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Ambient decorative blobs — pinned behind everything */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute top-1/2 -right-20 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />
          <div className="absolute bottom-0 left-10 h-64 w-64 rounded-full bg-primary-200/40 blur-3xl" />
        </div>

        <TopNavBar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((isOpen) => !isOpen)}
        />
        <main className="relative flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
