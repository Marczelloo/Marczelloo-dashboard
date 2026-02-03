"use server";

import { verifyPin, createPinSession, clearPinSession, getCurrentUser, isPinSessionValid } from "@/server/lib/auth";
import { auditLogs } from "@/server/atlashub";

export async function verifyPinAction(pin: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false as const, error: "Not authenticated" };
    }

    const isValid = await verifyPin(pin);

    if (!isValid) {
      await auditLogs.logAction(user.email, "pin_verify", "auth", undefined, { success: false });
      return { success: false as const, error: "Invalid PIN" };
    }

    await createPinSession();
    await auditLogs.logAction(user.email, "pin_verify", "auth", undefined, { success: true });

    return { success: true as const };
  } catch (error) {
    console.error("verifyPinAction error:", error);
    return { success: false as const, error: "PIN verification failed" };
  }
}

export async function checkPinSessionAction() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false as const, authenticated: false, pinVerified: false };
    }

    const pinVerified = await isPinSessionValid();

    return {
      success: true as const,
      authenticated: true,
      pinVerified,
      email: user.email,
    };
  } catch (error) {
    console.error("checkPinSessionAction error:", error);
    return { success: false as const, authenticated: false, pinVerified: false };
  }
}

export async function logoutAction() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await auditLogs.logAction(user.email, "login", "auth", undefined, { action: "logout" });
    }

    await clearPinSession();

    return { success: true as const };
  } catch (error) {
    console.error("logoutAction error:", error);
    return { success: false as const, error: "Logout failed" };
  }
}
