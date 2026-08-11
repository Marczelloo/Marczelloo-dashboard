"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[DashboardError] Unhandled dashboard render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <div>
            <h1 className="text-lg font-semibold">Dashboard temporarily unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A temporary data-source error occurred. Try loading this page again in a moment.
            </p>
          </div>
          <Button onClick={() => reset()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
