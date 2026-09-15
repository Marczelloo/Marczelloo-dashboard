export interface PortBinding {
  hostIp: string;
  hostPort: number;
  containerPort: number;
  protocol: string;
}

export interface MountFact {
  type: string;
  name: string | null;
  source: string;
  destination: string;
  readOnly: boolean;
}

export interface ContainerFact {
  id: string;
  name: string;
  image: string;
  imageId: string;
  status: string;
  createdAt: string;
  composeProject: string | null;
  composeService: string | null;
  oneOff: boolean;
  workingDir: string | null;
  configFiles: string[];
  env: Record<string, string>;
  labels: Record<string, string>;
  ports: PortBinding[];
  mounts: MountFact[];
  networks: string[];
}

export interface IngressRule {
  position: number;
  hostname: string | null;
  path: string | null;
  service: string;
  originRequest: Record<string, unknown> | null;
}

export interface ComposePort {
  target: number;
  published?: string;
  host_ip?: string;
  protocol?: string;
}

export interface ComposeVolumeMount {
  type: string;
  source?: string;
  target: string;
  read_only?: boolean;
}

export interface ComposeServiceConfig {
  image?: string;
  build?: unknown;
  container_name?: string;
  environment?: Record<string, string | null>;
  ports?: ComposePort[];
  volumes?: ComposeVolumeMount[];
  labels?: Record<string, string>;
  logging?: unknown;
  restart?: string;
  profiles?: string[];
  [key: string]: unknown;
}

export interface ComposeConfig {
  name?: string;
  services: Record<string, ComposeServiceConfig>;
  volumes?: Record<string, { name?: string; external?: boolean } | null>;
  networks?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EnvFileSnapshot {
  path: string;
  content: string | null;
}

export interface GitFact {
  head: string;
  remote: string | null;
}

export interface StackSnapshot {
  project: string;
  workingDir: string | null;
  configFiles: string[];
  containers: ContainerFact[];
  composeConfig: ComposeConfig | null;
  composeConfigError: string | null;
  envFiles: EnvFileSnapshot[];
  otherEnvFiles: string[];
  git: GitFact | null;
}

export interface InventorySnapshot {
  capturedAt: string;
  stacks: StackSnapshot[];
  looseContainers: ContainerFact[];
  imageEnv: Record<string, Record<string, string>>;
  ingress: { rules: IngressRule[]; error: string | null };
}
