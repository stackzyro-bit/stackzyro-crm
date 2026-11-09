import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md px-6 py-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">404</p>
        <h1 className="mt-2 text-[20px] font-semibold text-ink-900">Page not found</h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
          The page you are looking for does not exist or may have been moved.
        </p>
        <Link to="/dashboard" className="mt-5 inline-block">
          <Button leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>Back to dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
