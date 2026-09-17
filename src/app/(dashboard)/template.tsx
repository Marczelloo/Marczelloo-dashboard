"use client";

import { motion } from "framer-motion";

// Re-mounts on every navigation: content fades up 4 px; the shell in layout.tsx stays still.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
