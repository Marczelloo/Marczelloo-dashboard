// ========================================
// Portainer API Types
// ========================================

export interface PortainerEndpoint {
  Id: number;
  Name: string;
  Type: number;
  URL: string;
  Status: number;
  Snapshots: PortainerSnapshot[];
}

export interface PortainerSnapshot {
  DockerVersion: string;
  TotalCPU: number;
  TotalMemory: number;
  RunningContainerCount: number;
  StoppedContainerCount: number;
  HealthyContainerCount: number;
  UnhealthyContainerCount: number;
  Time: number;
}

export interface PortainerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  Ports: PortainerPort[];
  State: string;
  Status: string;
  HostConfig: {
    NetworkMode: string;
  };
  NetworkSettings: {
    Networks: Record<string, unknown>;
  };
  Mounts: PortainerMount[];
  Labels: Record<string, string>;
  Health?: {
    Status: string;
    FailingStreak: number;
    Log: HealthLog[];
  };
}

export interface PortainerPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

export interface PortainerMount {
  Type: string;
  Source: string;
  Destination: string;
  Mode: string;
  RW: boolean;
}

export interface HealthLog {
  Start: string;
  End: string;
  ExitCode: number;
  Output: string;
}

export interface PortainerStack {
  Id: number;
  Name: string;
  Type: number;
  EndpointId: number;
  SwarmId?: string;
  EntryPoint: string;
  Env: StackEnvVar[];
  ResourceControl?: unknown;
  Status: number;
  ProjectPath: string;
  CreationDate: number;
  CreatedBy: string;
  UpdateDate: number;
  UpdatedBy: string;
}

export interface StackEnvVar {
  name: string;
  value: string;
}

export interface ContainerLogs {
  logs: string;
  timestamp: string;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
}

export type ContainerAction = "start" | "stop" | "restart" | "kill" | "pause" | "unpause" | "recreate";

export interface PortainerActionResult {
  success: boolean;
  message?: string;
  error?: string;
}
