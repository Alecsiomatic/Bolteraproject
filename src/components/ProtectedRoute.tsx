import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Array<"ADMIN" | "OPERATOR" | "VIEWER" | "USER">;
}

const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se especifican roles, verificar que el usuario tenga uno de esos roles
  if (roles && !roles.includes(user.role)) {
    // Si el usuario es USER y trata de acceder a admin, redirigir a mi-cuenta
    if (user.role === "USER" && location.pathname.startsWith("/admin")) {
      return <Navigate to="/mi-cuenta" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
