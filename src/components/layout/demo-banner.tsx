"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Github, ExternalLink, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface DemoBannerProps {
  githubUrl?: string;
}

const DEMO_DIALOG_DISMISSED_KEY = "marczelloo-demo-dialog-dismissed";

export function DemoBanner({ githubUrl = "https://github.com/marczelloo/dashboard" }: DemoBannerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showIndicator, setShowIndicator] = useState(true);

  useEffect(() => {
    // Check if dialog was already dismissed in this session
    const dismissed = sessionStorage.getItem(DEMO_DIALOG_DISMISSED_KEY);
    if (!dismissed) {
      setShowDialog(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowDialog(false);
    sessionStorage.setItem(DEMO_DIALOG_DISMISSED_KEY, "true");
  };

  const handleReopenDialog = () => {
    setShowDialog(true);
  };

  return (
    <>
      {/* Small floating indicator */}
      {showIndicator && !showDialog && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReopenDialog}
            className="bg-background/95 backdrop-blur-sm border-primary/30 hover:border-primary shadow-lg"
          >
            <Info className="h-4 w-4 mr-2 text-primary" />
            <span className="text-sm">Demo Mode</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/95 backdrop-blur-sm shadow-lg"
            onClick={() => setShowIndicator(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Welcome Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                <AlertTriangle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Welcome to the Demo</DialogTitle>
                <Badge variant="outline" className="mt-1 border-primary/30 text-primary">
                  Preview Mode
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-left pt-2">
              You&apos;re viewing a demonstration of the Marczelloo Dashboard — a self-hosted project management panel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* What this demo shows */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                What you can explore
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
                <li>• Browse mock projects, services, and deployments</li>
                <li>• View the monitoring dashboard and status indicators</li>
                <li>• Explore container management UI and Raspberry Pi metrics</li>
                <li>• Check out the audit log and work item tracking</li>
              </ul>
            </div>

            {/* Limitations */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                Demo limitations
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
                <li>• All data is simulated (nothing is saved)</li>
                <li>• Create, edit, and delete actions are disabled</li>
                <li>• Deployments and container actions won&apos;t execute</li>
                <li>• No real infrastructure connections</li>
              </ul>
            </div>

            {/* Source code link */}
            {githubUrl && (
              <div className="rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Github className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Want to see the code?</p>
                      <p className="text-xs text-muted-foreground">This project is open source</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={githubUrl} target="_blank" rel="noopener noreferrer">
                      View Source
                      <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleDismiss} className="px-6">
              Got it, let me explore
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
