import type { Request, Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getBackupDownloadRecord } from "./db";
import { storageGetSignedUrl } from "./storage";

export async function downloadBusinessBackup(req: Request, res: Response) {
  try {
    const backupId = Number(req.params.id);
    if (!Number.isInteger(backupId) || backupId <= 0) {
      res.status(400).json({ error: "Invalid backup identifier." });
      return;
    }

    const record = await getBackupDownloadRecord(backupId);
    if (!record) {
      res.status(404).json({ error: "This successful backup could not be found." });
      return;
    }

    const signedUrl = await storageGetSignedUrl(record.storageKey!);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok || !upstream.body) {
      throw new Error(`Backup storage returned ${upstream.status}.`);
    }

    const safeName = `${record.recordCode}.zip`.replace(/[^a-zA-Z0-9._-]/g, "_");
    res.status(200);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    await pipeline(Readable.fromWeb(upstream.body as never), res);
  } catch (error) {
    console.error("[Backup Download] Failed:", error);
    if (!res.headersSent) {
      res.status(502).json({ error: "The backup could not be downloaded. Please try again." });
    }
  }
}
