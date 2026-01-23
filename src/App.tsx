import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Critical path - load immediately
import Events from "./pages/Events";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy load all other pages
const Index = lazy(() => import("./pages/Index"));
const Register = lazy(() => import("./pages/Register"));
const AdminLayout = lazy(() => import("./pages/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminEvents = lazy(() => import("./pages/AdminEvents"));
const AdminEventCreate = lazy(() => import("./pages/AdminEventCreate"));
const AdminEventDetail = lazy(() => import("./pages/AdminEventDetail"));
const AdminEventEdit = lazy(() => import("./pages/AdminEventEdit"));
const AdminVenues = lazy(() => import("./pages/AdminVenues"));
const AdminVenueCreate = lazy(() => import("./pages/AdminVenueCreate"));
const AdminVenueEdit = lazy(() => import("./pages/AdminVenueEdit"));
const AdminCategories = lazy(() => import("./pages/AdminCategories"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminCheckin = lazy(() => import("./pages/AdminCheckin"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons"));
const AdminMercadoPago = lazy(() => import("./pages/AdminMercadoPago"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminTickets = lazy(() => import("./pages/AdminTickets"));
const AdminCourtesies = lazy(() => import("./pages/AdminCourtesies"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Public pages
const EventDetail = lazy(() => import("./pages/EventDetail"));
const EventPurchase = lazy(() => import("./pages/EventPurchase"));
const MyTickets = lazy(() => import("./pages/MyTickets"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Profile = lazy(() => import("./pages/Profile"));

// User Panel pages
const UserLayout = lazy(() => import("./pages/UserLayout"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const UserOrders = lazy(() => import("./pages/UserOrders"));
const UserUpcoming = lazy(() => import("./pages/UserUpcoming"));
const UserFavorites = lazy(() => import("./pages/UserFavorites"));
const UserProfile = lazy(() => import("./pages/UserProfile"));

// Payment pages
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFailure = lazy(() => import("./pages/PaymentFailure"));
const PaymentPending = lazy(() => import("./pages/PaymentPending"));

// Auth pages
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Music System
const AdminArtists = lazy(() => import("./pages/AdminArtists"));
const AdminPlaylists = lazy(() => import("./pages/AdminPlaylists"));
const ArtistPage = lazy(() => import("./pages/ArtistPage"));
const Artists = lazy(() => import("./pages/Artists"));
const Playlists = lazy(() => import("./pages/Playlists"));
const MusicPlayer = lazy(() => import("./components/MusicPlayer"));

// Optimized QueryClient with better caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading spinner
const PageLoader = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-[#ffc800] border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Landing es ahora Events */}
            <Route path="/" element={<Events />} />
            <Route path="/canvas" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Payment Return Pages */}
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/failure" element={<PaymentFailure />} />
            <Route path="/payment/pending" element={<PaymentPending />} />
            
            {/* Public Event Pages */}
            <Route path="/events" element={<Navigate to="/" replace />} />
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/events/:eventId/purchase" element={<EventPurchase />} />
            <Route path="/artistas" element={<Artists />} />
            <Route path="/artista/:slug" element={<ArtistPage />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/my-tickets" element={<MyTickets />} />
            <Route path="/order/:orderNumber" element={<OrderConfirmation />} />
            <Route path="/profile" element={<Profile />} />
            
            {/* User Panel */}
            <Route
              path="/mi-cuenta"
              element={
                <ProtectedRoute>
                  <UserLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<UserDashboard />} />
              <Route path="boletos" element={<MyTickets />} />
              <Route path="ordenes" element={<UserOrders />} />
              <Route path="proximos" element={<UserUpcoming />} />
              <Route path="favoritos" element={<UserFavorites />} />
              <Route path="perfil" element={<UserProfile />} />
            </Route>
            
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="events/new" element={<AdminEventCreate />} />
              <Route path="events/:eventId" element={<AdminEventDetail />} />
              <Route path="events/:eventId/edit" element={<AdminEventEdit />} />
              <Route path="venues" element={<AdminVenues />} />
              <Route path="venues/new" element={<AdminVenueCreate />} />
              <Route path="venues/:venueId/edit" element={<AdminVenueEdit />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="courtesies" element={<AdminCourtesies />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="checkin" element={<AdminCheckin />} />
              <Route path="artists" element={<AdminArtists />} />
              <Route path="playlists" element={<AdminPlaylists />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="payments" element={<AdminMercadoPago />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          {/* Global Music Player */}
          <MusicPlayer />
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
