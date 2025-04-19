import { ccc } from "@ckb-ccc/shell";

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join, parse } from "path";
import { fileURLToPath } from "url";
import { inspect } from "util";

interface RgbppTxLog {
  btcTxId?: string;
  rawBtcTxHex?: string;

  ckbTxId?: string;
  ckbPartialTx?: ccc.Transaction;
  ckbFinalTx?: ccc.Transaction;

  startTime?: string;
  endTime?: string;
  error?: string;
  [key: string]: string | ccc.Transaction | undefined;
}

type NewLoggerOptions = {
  opType: string;
  dir?: string;
};

type ExistingLoggerOptions = {
  fileName: string;
  dir?: string;
};

export class RgbppTxLogger {
  private logFilePath: string;
  private currentLog: RgbppTxLog;

  constructor(options: NewLoggerOptions | ExistingLoggerOptions) {
    this.currentLog = {};

    if ("fileName" in options) {
      try {
        this.logFilePath = join(
          options.dir ?? RgbppTxLogger.defaultDir(),
          options.fileName
        );

        parse(this.logFilePath);
        if (!existsSync(this.logFilePath)) {
          const dir = dirname(this.logFilePath);
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          this.currentLog = {};
          writeFileSync(this.logFilePath, JSON.stringify(this.currentLog));
        } else {
          const content = readFileSync(this.logFilePath, "utf8");
          const txLog = JSON.parse(content);
          if (typeof txLog !== "object" || txLog === null) {
            throw new Error("content must be an object of RgbppTxLog");
          }
          this.currentLog = txLog;
        }
      } catch (error) {
        throw new Error(`Invalid logFilePath: ${String(error)}`);
      }

      return;
    }

    const dir = options.dir ?? RgbppTxLogger.defaultDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.logFilePath = join(dir, `${options.opType}-${Date.now()}-logs.json`);
  }

  static createFromLogFile(
    fileName: string,
    dir = RgbppTxLogger.defaultDir()
  ): RgbppTxLogger {
    return new RgbppTxLogger({ fileName, dir });
  }

  static defaultDir(): string {
    return dirname(dirname(fileURLToPath(import.meta.url))) + "/tmp";
  }

  currentTime(): string {
    return new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
      formatMatcher: "basic",
    });
  }

  add(key: string, value: string, doPrint = false): void {
    this.currentLog[key] = value;
    this.logStartTime();
    if (doPrint) {
      console.log(`${key}: ${value}`);
    }
  }

  // * using ccc.Transaction.toBytes() would lose optional fields of CellInput
  logCkbTx(key: string, ckbTx: ccc.Transaction, doPrint = false): void {
    this.currentLog[key] = ckbTx;
    if (doPrint) {
      console.log(inspect(ckbTx, { depth: null, colors: true }));
    }
  }

  logStartTime(): void {
    if (!this.currentLog.startTime) {
      this.currentLog.startTime = this.currentTime();
    }
  }

  logEndTime(): void {
    if (!this.currentLog.endTime) {
      this.currentLog.endTime = this.currentTime();
    }
  }

  getLogValue(key: string, doPrint = false): unknown {
    const value = this.currentLog[key];
    if (doPrint) {
      console.log(`${key}: ${value ?? ""}`);
    }
    return value;
  }

  getCkbTxPartialFromLogFile(doPrint = false): ccc.Transaction {
    const ckbTx = this.currentLog.ckbPartialTx;
    if (!ckbTx) {
      throw new Error("ckbPartialTx not found in log file");
    }
    if (doPrint) {
      console.log(inspect(ckbTx, { depth: null, colors: true }));
    }
    return ckbTx;
  }

  saveOnSuccess(): void {
    this.logStartTime();
    this.logEndTime();
    this.saveLog(this.logFilePath);
  }

  saveOnError(error: Error): void {
    this.logStartTime();
    this.logEndTime();
    this.currentLog.error = error.message;
    this.saveLog(this.logFilePath);
  }

  saveLog(filePath: string): void {
    try {
      writeFileSync(
        filePath,
        JSON.stringify(
          this.currentLog,
          (_, value) =>
            typeof value === "bigint" ? ccc.numToHex(value) : value,
          2
        )
      );
      console.log("Log saved to", parse(filePath).base);
    } catch (error) {
      console.error("Failed to save log:", error);
      throw error;
    }
  }
}
