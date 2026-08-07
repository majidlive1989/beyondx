import net from "node:net";
import tls from "node:tls";
import { AppError } from "@beyondx/core";
import type { Mailer, MailMessage } from "../application/contracts.js";

export interface SmtpMailerOptions {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  timeoutMs?: number;
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeData(value: string): string {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

export class SmtpMailer implements Mailer {
  constructor(private readonly options: SmtpMailerOptions) {}

  async send(message: MailMessage): Promise<void> {
    const connection = await this.connect();
    try {
      await this.expect(connection, [220]);
      await this.command(connection, "EHLO beyondx.local\r\n", [250]);
      await this.command(connection, `MAIL FROM:<${this.options.from}>\r\n`, [250]);
      await this.command(connection, `RCPT TO:<${message.to}>\r\n`, [250, 251]);
      await this.command(connection, "DATA\r\n", [354]);

      const boundary = `beyondx-${Date.now().toString(36)}`;
      const payload = [
        `From: BeyondX <${sanitizeHeader(this.options.from)}>`,
        `To: ${sanitizeHeader(message.to)}`,
        `Subject: ${sanitizeHeader(message.subject)}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        escapeData(message.text),
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        escapeData(message.html),
        `--${boundary}--`,
        "",
        ".",
        "",
      ].join("\r\n");
      await this.command(connection, payload, [250]);
      await this.command(connection, "QUIT\r\n", [221]);
    } finally {
      connection.end();
    }
  }

  private connect(): Promise<net.Socket> {
    const timeoutMs = this.options.timeoutMs ?? 5_000;
    return new Promise((resolve, reject) => {
      const connection = this.options.secure
        ? tls.connect({ host: this.options.host, port: this.options.port })
        : net.createConnection({ host: this.options.host, port: this.options.port });
      const readyEvent = this.options.secure ? "secureConnect" : "connect";

      const cleanup = (): void => {
        connection.setTimeout(0);
        connection.off("error", onError);
        connection.off(readyEvent, onReady);
      };
      const onError = (error: Error): void => {
        cleanup();
        reject(this.smtpError("SMTP connection failed", error));
      };
      const onReady = (): void => {
        cleanup();
        resolve(connection);
      };
      const onTimeout = (): void => {
        cleanup();
        connection.destroy();
        reject(this.smtpError("SMTP connection timed out"));
      };

      connection.setTimeout(timeoutMs, onTimeout);
      connection.once("error", onError);
      connection.once(readyEvent, onReady);
    });
  }

  private command(
    connection: net.Socket,
    command: string,
    expectedCodes: number[],
  ): Promise<string> {
    connection.write(command);
    return this.expect(connection, expectedCodes);
  }

  private expect(connection: net.Socket, expectedCodes: number[]): Promise<string> {
    const timeoutMs = this.options.timeoutMs ?? 5_000;
    return new Promise((resolve, reject) => {
      let response = "";
      const timeout = setTimeout(() => {
        cleanup();
        reject(this.smtpError("SMTP command timed out"));
      }, timeoutMs);

      const cleanup = (): void => {
        clearTimeout(timeout);
        connection.off("data", onData);
        connection.off("error", onError);
        connection.off("close", onClose);
      };
      const fail = (message: string, cause?: unknown): void => {
        cleanup();
        reject(this.smtpError(message, cause));
      };
      const onError = (error: Error): void => fail("SMTP command failed", error);
      const onClose = (): void => fail("SMTP connection closed unexpectedly");
      const onData = (data: Buffer): void => {
        response += data.toString("utf8");
        const lines = response.split(/\r?\n/).filter(Boolean);
        const lastLine = lines.at(-1);
        if (!lastLine || !/^\d{3} /.test(lastLine)) return;
        const code = Number(lastLine.slice(0, 3));
        if (!expectedCodes.includes(code)) {
          fail(`SMTP server rejected command: ${response.trim()}`);
          return;
        }
        cleanup();
        resolve(response);
      };

      connection.on("data", onData);
      connection.once("error", onError);
      connection.once("close", onClose);
    });
  }

  private smtpError(message: string, cause?: unknown): AppError {
    return new AppError({
      code: "IDENTITY_EMAIL_DELIVERY_FAILED",
      message,
      statusCode: 502,
      ...(cause === undefined ? {} : { cause }),
    });
  }
}