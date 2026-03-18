import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { BackButton } from "@/components/BackButton";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <BackButton to="/dashboard" label="Back to Dashboard" className="inline-flex" />
      </div>
    </div>
  );
};

export default NotFound;
