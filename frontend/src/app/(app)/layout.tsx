import { AppHeader } from "@/components/app-header";
import { ApsViewerProvider } from "@/components/aps-viewer-provider";
import { CurrentUserProvider } from "@/components/current-user-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <div className="flex flex-col h-screen">
        <AppHeader />
        <ApsViewerProvider>{children}</ApsViewerProvider>
      </div>
    </CurrentUserProvider>
  );
}
