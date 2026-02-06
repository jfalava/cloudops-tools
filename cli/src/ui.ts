import process from "node:process";
import pc from "picocolors";

const isColorEnabled = (): boolean => {
  const force = process.env.FORCE_COLOR;
  if (force === "0") {
    return false;
  }
  if (force && force !== "0") {
    return true;
  }
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  return process.stdout?.isTTY === true;
};

const colors = pc.createColors(isColorEnabled());

export const ui = {
  info: (text: string) => colors.cyan(text),
  warn: (text: string) => colors.yellow(text),
  error: (text: string) => colors.red(text),
  success: (text: string) => colors.green(text),
  dim: (text: string) => colors.dim(text),
  bold: (text: string) => colors.bold(text),
  plain: (text: string) => text,
};
