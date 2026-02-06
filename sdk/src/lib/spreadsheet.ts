import ExcelJS from "exceljs";

import type { WebInventoryData } from "./json-output";

import { isObjectRecord } from "./aws-payload";

/**
 * Parses CSV data into a 2D array
 */
function parseCsvToArray(csvData: string): string[][] {
  const lines = csvData.trim().split("\n");
  return lines.map((line) => {
    // Simple CSV parsing - handles basic cases
    // For more complex CSV with quotes/escapes, we'd need a proper CSV parser
    // but here we are usually dealing with the output of our own tool
    const cells: string[] = [];
    let inQuotes = false;
    let currentCell = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());
    return cells;
  });
}

/**
 * Converts CSV data to XLSX (Excel) format and writes it to a file.
 */
export async function csvToXlsx(csvData: string, outputPath: string): Promise<void> {
  const data = parseCsvToArray(csvData);

  if (data.length === 0) {
    throw new Error("Failed to parse CSV data");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Inventory");

  worksheet.addRows(data);

  // Auto-size columns based on content
  worksheet.columns.forEach((column: unknown, index: number) => {
    if (isObjectRecord(column) && data.length > 0) {
      const maxLength = Math.max(
        ...data.map((row) => (row && row[index] ? row[index].toString().length : 0)),
      );
      (column as { width?: number }).width = Math.min(maxLength + 2, 50);
    }
  });

  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  await Bun.write(outputPath, xlsxBuffer);
}

/**
 * Writes data in the specified format(s).
 */
export async function writeInventoryFile(
  csvData: string,
  basePath: string,
  format: string,
  _sheetName?: string,
): Promise<void> {
  const shouldWriteCsv = format === "csv" || format === "both" || format === "all";
  const shouldWriteXlsx = format === "xlsx" || format === "both" || format === "all";

  if (shouldWriteCsv) {
    const csvPath = basePath.endsWith(".csv") ? basePath : `${basePath}.csv`;
    await Bun.write(csvPath, csvData);
  }

  if (shouldWriteXlsx) {
    const xlsxPath = basePath.endsWith(".csv")
      ? basePath.replace(/\.csv$/, ".xlsx")
      : `${basePath}.xlsx`;
    await csvToXlsx(csvData, xlsxPath);
  }
}

/**
 * Writes consolidated JSON inventory file.
 */
export async function writeJsonInventory(
  data: WebInventoryData,
  outputPath: string,
): Promise<void> {
  const jsonPath = outputPath.endsWith(".json") ? outputPath : `${outputPath}.json`;
  const jsonString = JSON.stringify(data, null, 2);
  await Bun.write(jsonPath, jsonString);
}
