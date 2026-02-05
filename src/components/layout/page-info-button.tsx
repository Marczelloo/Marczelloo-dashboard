"use client";

import {
  Info,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Rocket,
  Activity,
  Terminal,
  Box,
  Settings,
  FileText,
  Lightbulb,
  Newspaper,
  CheckSquare,
  Clock,
  GitBranch,
  Shield,
  RefreshCw,
  Database,
  Link,
  Search,
  Filter,
  Download,
  HardDrive,
  Cpu,
  Wifi,
  Bell,
  PlusCircle,
  ListChecks,
  Server,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Icon map for string-based icon lookup (avoids serialization issues)
const ICON_MAP: Record<string, LucideIcon> = {
  Plus,
  Eye,
  Pencil,
  Trash2,
  Rocket,
  Activity,
  Terminal,
  Box,
  Settings,
  FileText,
  Lightbulb,
  Newspaper,
  CheckSquare,
  Clock,
  GitBranch,
  Shield,
  RefreshCw,
  Database,
  Link,
  Search,
  Filter,
  Download,
  HardDrive,
  Cpu,
  Wifi,
  Bell,
  PlusCircle,
  ListChecks,
  Server,
  Info,
};

export interface InfoItem {
  icon: string; // Icon name as string
  title: string;
  description: string;
}

interface PageInfoButtonProps {
  title: string;
  description?: string;
  items: InfoItem[];
}

export function PageInfoButton({ title, description, items }: PageInfoButtonProps) {
  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
                <span className="sr-only">Page information</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>What can I do here?</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-red-500" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {items.map((item, index) => {
            const Icon = ICON_MAP[item.icon] || Info;
            return (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Icon className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
