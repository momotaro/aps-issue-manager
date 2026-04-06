import { AppHeader } from "@/components/app-header";
import { ApsViewerProvider } from "@/components/aps-viewer-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      <AppHeader />
      <ApsViewerProvider>{children}</ApsViewerProvider>
    </div>
  );
}
