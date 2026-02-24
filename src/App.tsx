import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load páginas pesadas
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tickets = lazy(() => import("./pages/Tickets"));
const TicketDetail = lazy(() => import("./pages/TicketDetail"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const Reports = lazy(() => import("./pages/Reports"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Assets = lazy(() => import("./pages/Assets"));
const Technicians = lazy(() => import("./pages/Technicians"));
const DailyServices = lazy(() => import("./pages/DailyServices"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const ServiceOrderPage = lazy(() => import("./pages/ServiceOrderPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicTicket = lazy(() => import("./pages/PublicTicket"));
const Analytics = lazy(() => import("./pages/Analytics"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const WhatsAppSettings = lazy(() => import("./pages/WhatsAppSettings"));
const WABAChat = lazy(() => import("./pages/WABAChat"));
const AISupportChat = lazy(() => import("./pages/AISupportChat"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (anteriormente cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Skeleton className="h-96 w-full max-w-4xl" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/public/ticket" element={<PublicTicket />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/daily-services" element={<DailyServices />} />
            <Route path="/service-orders/new" element={<ServiceOrderPage />} />
            <Route path="/profile/settings" element={<ProfileSettings />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />
            <Route path="/whatsapp-settings" element={<WhatsAppSettings />} />
            <Route path="/waba-chat" element={<WABAChat />} />
            <Route path="/ai-support" element={<AISupportChat />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
