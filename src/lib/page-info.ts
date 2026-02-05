import type { InfoItem } from "@/components/layout/page-info-button";

export const PAGE_INFO = {
  dashboard: {
    title: "Dashboard Overview",
    description: "Your central command center for monitoring all projects and services.",
    items: [
      {
        icon: "Eye",
        title: "Monitor Status",
        description: "View real-time status of all your projects, services, and deployments at a glance.",
      },
      {
        icon: "Activity",
        title: "Track Uptime",
        description: "See uptime statistics and health checks for all monitored services.",
      },
      {
        icon: "Clock",
        title: "Recent Activity",
        description: "Check recent deployments, work items, and system events.",
      },
      {
        icon: "Bell",
        title: "Alerts",
        description: "Get notified about downtime, failed deployments, or issues requiring attention.",
      },
    ] as InfoItem[],
  },

  projects: {
    title: "Projects",
    description: "Manage all your self-hosted and external projects.",
    items: [
      {
        icon: "Plus",
        title: "Create Project",
        description: "Add a new project to track. Link it to GitHub repos and configure deployment settings.",
      },
      {
        icon: "Eye",
        title: "View Details",
        description: "Click on any project to see its services, work items, and deployment history.",
      },
      {
        icon: "GitBranch",
        title: "GitHub Sync",
        description: "Import projects directly from GitHub and keep them synchronized.",
      },
      {
        icon: "Filter",
        title: "Filter & Search",
        description: "Use filters to find projects by status, type, or search by name.",
      },
    ] as InfoItem[],
  },

  projectDetail: {
    title: "Project Details",
    description: "Manage individual project settings, services, and work items.",
    items: [
      {
        icon: "Pencil",
        title: "Edit Project",
        description: "Update project name, description, repository URL, and other settings.",
      },
      {
        icon: "Server",
        title: "Manage Services",
        description: "Add, remove, or configure services associated with this project.",
      },
      {
        icon: "CheckSquare",
        title: "Work Items",
        description: "Track tasks, bugs, and features. Create GitHub issues directly from work items.",
      },
      {
        icon: "Rocket",
        title: "Deploy",
        description: "Trigger deployments, create releases, and view deployment history.",
      },
      {
        icon: "Trash2",
        title: "Delete Project",
        description: "Permanently remove the project and all associated data (requires PIN).",
      },
    ] as InfoItem[],
  },

  services: {
    title: "Services",
    description: "Monitor and manage all your running services and containers.",
    items: [
      {
        icon: "Plus",
        title: "Add Service",
        description: "Register a new service for monitoring. Configure health checks and alerts.",
      },
      {
        icon: "Activity",
        title: "Health Status",
        description: "View real-time health status, uptime percentage, and response times.",
      },
      {
        icon: "RefreshCw",
        title: "Quick Actions",
        description: "Restart, stop, or redeploy services directly from the list.",
      },
      {
        icon: "Filter",
        title: "Filter Services",
        description: "Filter by status (healthy, degraded, down) or service type.",
      },
    ] as InfoItem[],
  },

  serviceDetail: {
    title: "Service Details",
    description: "Deep dive into service configuration, logs, and metrics.",
    items: [
      {
        icon: "Terminal",
        title: "View Logs",
        description: "Access real-time and historical logs from the container.",
      },
      {
        icon: "Settings",
        title: "Environment Variables",
        description: "View and edit environment variables (PIN required to reveal values).",
      },
      {
        icon: "Activity",
        title: "Uptime History",
        description: "See historical uptime data and incident timeline.",
      },
      {
        icon: "Rocket",
        title: "Deploy Actions",
        description: "Pull latest code, rebuild, restart, or recreate containers.",
      },
      {
        icon: "Box",
        title: "Container Info",
        description: "View container details, resource usage, and Portainer links.",
      },
    ] as InfoItem[],
  },

  todos: {
    title: "General Todos",
    description: "Track personal tasks and reminders not tied to specific projects.",
    items: [
      {
        icon: "PlusCircle",
        title: "Create Todo",
        description: "Add a new task with title, priority, and optional due date.",
      },
      {
        icon: "CheckSquare",
        title: "Mark Complete",
        description: "Click the checkbox to mark tasks as done.",
      },
      {
        icon: "ListChecks",
        title: "Organize",
        description: "Filter by status (pending, completed) or priority level.",
      },
      {
        icon: "Trash2",
        title: "Delete",
        description: "Remove completed or unnecessary tasks.",
      },
    ] as InfoItem[],
  },

  monitoring: {
    title: "Monitoring",
    description: "Comprehensive uptime monitoring and alerting for all services.",
    items: [
      {
        icon: "Activity",
        title: "Uptime Charts",
        description: "View uptime trends, response times, and availability percentages.",
      },
      {
        icon: "Bell",
        title: "Alert Configuration",
        description: "Set up Discord/email alerts for downtime or degraded performance.",
      },
      {
        icon: "Clock",
        title: "Check History",
        description: "Browse historical check results and incident timelines.",
      },
      {
        icon: "Shield",
        title: "SSL Monitoring",
        description: "Track SSL certificate expiry and get alerts before expiration.",
      },
    ] as InfoItem[],
  },

  containers: {
    title: "Containers",
    description: "Manage Docker containers through Portainer integration.",
    items: [
      {
        icon: "Box",
        title: "Container List",
        description: "View all running and stopped containers with their status.",
      },
      {
        icon: "RefreshCw",
        title: "Container Actions",
        description: "Start, stop, restart, or remove containers.",
      },
      {
        icon: "Terminal",
        title: "Container Logs",
        description: "View real-time logs from any container.",
      },
      {
        icon: "Database",
        title: "Resource Usage",
        description: "Monitor CPU, memory, and network usage per container.",
      },
    ] as InfoItem[],
  },

  pi: {
    title: "Raspberry Pi",
    description: "Monitor your Raspberry Pi host system.",
    items: [
      {
        icon: "Cpu",
        title: "System Stats",
        description: "View CPU usage, temperature, and load averages.",
      },
      {
        icon: "HardDrive",
        title: "Storage",
        description: "Monitor disk usage and available space.",
      },
      {
        icon: "Database",
        title: "Memory",
        description: "Track RAM and swap usage.",
      },
      {
        icon: "Wifi",
        title: "Network",
        description: "View network interfaces and connectivity status.",
      },
    ] as InfoItem[],
  },

  news: {
    title: "News Feed",
    description: "Stay updated with relevant tech news and updates.",
    items: [
      {
        icon: "Newspaper",
        title: "Browse News",
        description: "View curated news from your configured sources.",
      },
      {
        icon: "Search",
        title: "Search",
        description: "Search for specific topics or articles.",
      },
      {
        icon: "Filter",
        title: "Filter Sources",
        description: "Filter news by source or category.",
      },
      {
        icon: "Link",
        title: "Read More",
        description: "Click articles to open full content in a new tab.",
      },
    ] as InfoItem[],
  },

  terminal: {
    title: "Web Terminal",
    description: "Execute commands on your server through the web interface.",
    items: [
      {
        icon: "Terminal",
        title: "Run Commands",
        description: "Execute allowlisted commands on the server.",
      },
      {
        icon: "Shield",
        title: "Security",
        description: "Only pre-approved commands can be executed for safety.",
      },
      {
        icon: "Clock",
        title: "Command History",
        description: "Browse and re-run previous commands.",
      },
      {
        icon: "Download",
        title: "Output",
        description: "View command output and copy results.",
      },
    ] as InfoItem[],
  },

  auditLog: {
    title: "Audit Log",
    description: "Track all actions and changes made in the dashboard.",
    items: [
      {
        icon: "FileText",
        title: "Action History",
        description: "View a complete log of all operations performed.",
      },
      {
        icon: "Search",
        title: "Search & Filter",
        description: "Find specific events by action type, user, or date range.",
      },
      {
        icon: "Shield",
        title: "Security Events",
        description: "Track login attempts, PIN verifications, and sensitive actions.",
      },
      {
        icon: "Download",
        title: "Export",
        description: "Export audit logs for compliance or review.",
      },
    ] as InfoItem[],
  },

  features: {
    title: "Feature Requests",
    description: "Track planned features and improvements for the dashboard.",
    items: [
      {
        icon: "Lightbulb",
        title: "View Roadmap",
        description: "See planned features and their implementation status.",
      },
      {
        icon: "Plus",
        title: "Submit Ideas",
        description: "Add new feature requests or improvement suggestions.",
      },
      {
        icon: "CheckSquare",
        title: "Vote",
        description: "Upvote features you want to see implemented.",
      },
      {
        icon: "GitBranch",
        title: "Track Progress",
        description: "Follow development progress of features in development.",
      },
    ] as InfoItem[],
  },

  docs: {
    title: "Documentation",
    description: "Access guides and reference documentation.",
    items: [
      {
        icon: "FileText",
        title: "Browse Docs",
        description: "Read documentation for the dashboard and its features.",
      },
      {
        icon: "Search",
        title: "Search",
        description: "Quickly find relevant documentation sections.",
      },
      {
        icon: "Link",
        title: "External Links",
        description: "Access related documentation for Portainer, Docker, etc.",
      },
      {
        icon: "Lightbulb",
        title: "Tips",
        description: "Learn tips and best practices for using the dashboard.",
      },
    ] as InfoItem[],
  },

  settings: {
    title: "Settings",
    description: "Configure dashboard, integrations, and notifications.",
    items: [
      {
        icon: "Settings",
        title: "General Settings",
        description: "Configure dashboard appearance and behavior.",
      },
      {
        icon: "Link",
        title: "Integrations",
        description: "Set up Portainer, GitHub, Discord, and other integrations.",
      },
      {
        icon: "Bell",
        title: "Notifications",
        description: "Configure email and Discord notification preferences.",
      },
      {
        icon: "Shield",
        title: "Security",
        description: "Manage PIN, access control, and security settings.",
      },
    ] as InfoItem[],
  },
} as const;
