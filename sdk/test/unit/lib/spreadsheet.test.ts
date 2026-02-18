import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ExcelJS from "exceljs";

import { csvToXlsx, writeInventoryFile } from "../../../src/lib/spreadsheet";

describe("writeInventoryFile", () => {
  const sampleCsv = `Name,Type,State
instance-1,t3.micro,running
instance-2,t3.small,stopped`;

  test("writes CSV file when format is 'csv'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      await writeInventoryFile(sampleCsv, basePath, "csv");

      const content = await readFile(`${basePath}.csv`, "utf-8");
      expect(content).toBe(sampleCsv);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("writes XLSX file when format is 'xlsx'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      await writeInventoryFile(sampleCsv, basePath, "xlsx");

      const content = await readFile(`${basePath}.xlsx`);
      expect(content.length).toBeGreaterThan(0);

      // Verify it's valid XLSX by parsing it
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content.buffer);
      const worksheet = workbook.getWorksheet("Inventory");
      expect(worksheet).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("writes both files when format is 'both'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      await writeInventoryFile(sampleCsv, basePath, "both");

      const csvContent = await readFile(`${basePath}.csv`, "utf-8");
      expect(csvContent).toBe(sampleCsv);

      const xlsxContent = await readFile(`${basePath}.xlsx`);
      expect(xlsxContent.length).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("writes both CSV and XLSX when format is 'all'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      await writeInventoryFile(sampleCsv, basePath, "all");

      const csvContent = await readFile(`${basePath}.csv`, "utf-8");
      expect(csvContent).toBe(sampleCsv);

      const xlsxContent = await readFile(`${basePath}.xlsx`);
      expect(xlsxContent.length).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("does not duplicate .csv extension", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory.csv");

    try {
      await writeInventoryFile(sampleCsv, basePath, "csv");

      const content = await readFile(basePath, "utf-8");
      expect(content).toBe(sampleCsv);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("replaces .csv with .xlsx for XLSX output", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory.csv");

    try {
      await writeInventoryFile(sampleCsv, basePath, "xlsx");

      const content = await readFile(basePath.replace(".csv", ".xlsx"));
      expect(content.length).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });
});

describe("csvToXlsx", () => {
  test("converts minimal CSV to valid XLSX", async () => {
    const csvData = "Name,Type\ninstance-1,t3.micro";
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "output.xlsx");

    try {
      await csvToXlsx(csvData, outputPath);

      const content = await readFile(outputPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content.buffer);
      const worksheet = workbook.getWorksheet("Inventory");

      expect(worksheet).toBeDefined();
      expect(worksheet?.getRow(1).getCell(1).value).toBe("Name");
      expect(worksheet?.getRow(2).getCell(1).value).toBe("instance-1");
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("handles quoted commas in fields", async () => {
    const csvData = 'Name,Description\ninstance-1,"This has, a comma"';
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "output.xlsx");

    try {
      await csvToXlsx(csvData, outputPath);

      const content = await readFile(outputPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content.buffer);
      const worksheet = workbook.getWorksheet("Inventory");

      expect(worksheet?.getRow(2).getCell(2).value).toBe("This has, a comma");
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("handles empty CSV gracefully", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "output.xlsx");

    try {
      // Empty CSV creates a valid XLSX with no data
      await csvToXlsx("", outputPath);

      const content = await readFile(outputPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content.buffer);
      const worksheet = workbook.getWorksheet("Inventory");

      expect(worksheet).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("handles whitespace-only CSV gracefully", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "output.xlsx");

    try {
      await csvToXlsx("   \n   ", outputPath);

      const content = await readFile(outputPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content.buffer);
      const worksheet = workbook.getWorksheet("Inventory");

      expect(worksheet).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("handles multiple rows with varying columns", async () => {
    const csvData = `Name,Type,State,Region
instance-1,t3.micro,running,us-east-1
instance-2,t3.small,stopped,us-west-2
instance-3,t3.large,running,eu-west-1`;

    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "output.xlsx");

    try {
      await csvToXlsx(csvData, outputPath);

      const content = await readFile(outputPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content.buffer);
      const worksheet = workbook.getWorksheet("Inventory");

      expect(worksheet?.rowCount).toBe(4);
      expect(worksheet?.getRow(1).getCell(1).value).toBe("Name");
      expect(worksheet?.getRow(4).getCell(2).value).toBe("t3.large");
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("handles header-only CSV", async () => {
    const csvData = "Name,Type,State";
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "output.xlsx");

    try {
      await csvToXlsx(csvData, outputPath);

      const content = await readFile(outputPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content.buffer);
      const worksheet = workbook.getWorksheet("Inventory");

      expect(worksheet?.rowCount).toBe(1);
      expect(worksheet?.getRow(1).getCell(1).value).toBe("Name");
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });
});
