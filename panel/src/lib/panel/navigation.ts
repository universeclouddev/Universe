import {
  LayoutDashboard,
  Sparkles,
  Server,
  Network,
  FileJson,
  FolderOpen,
  Terminal,
  BarChart3,
  Settings,
  History,
  Puzzle,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { ROUTE_PERMISSIONS, type PanelPermission } from "@/lib/panel/permissions";

export type NavCountKey = "instances" | "nodes" | "configurations" | "templates" | "extensions" | "schedules";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: NavCountKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/activity", label: "Activity", icon: History },
      { href: "/wizard", label: "First server", icon: Sparkles },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/instances", label: "Instances", icon: Server, countKey: "instances" },
      { href: "/configurations", label: "Configurations", icon: FileJson, countKey: "configurations" },
      { href: "/templates", label: "Templates", icon: FolderOpen, countKey: "templates" },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/cluster", label: "Cluster", icon: Network, countKey: "nodes" },
      { href: "/console", label: "Console", icon: Terminal },
      { href: "/schedules", label: "Schedules", icon: CalendarClock, countKey: "schedules" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/extensions", label: "Extensions", icon: Puzzle, countKey: "extensions" },
      { href: "/metrics", label: "Metrics", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Primary destinations shown in the mobile bottom nav. */
export const bottomNavItems: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/instances", label: "Instances", icon: Server, countKey: "instances" },
  { href: "/cluster", label: "Cluster", icon: Network, countKey: "nodes" },
  { href: "/console", label: "Console", icon: Terminal },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function navPermission(href: string): PanelPermission {
  return ROUTE_PERMISSIONS[href] ?? "dashboard.view";
}
