import type { Request, Response } from "express";
import { runScheduledBackupForTask } from "./db";
import { sdk } from "./_core/sdk";

/** Platform Heartbeat handler. Idempotent: retries reuse already-successful daily/weekly/monthly bundles. */
export async function runBusinessBackupSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await runScheduledBackupForTask(user.taskUid);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString(), context: { path: req.path } });
  }
}
