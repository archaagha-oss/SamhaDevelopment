import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "../contexts/AuthContext";

interface Props {
  children: ReactNode;
  roles?: Role[];
}

export default function RequireAuth({ children, roles }: Props) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (status === "anonymous" || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Access denied</h1>
        <p className="mt-2 text-gray-600">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
