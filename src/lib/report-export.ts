/**
 * Report Export Utilities
 * Functions for exporting reports to CSV and generating printable HTML
 */

import { format } from 'date-fns';
import { toCsv, downloadCsv } from '@/lib/csv';
import { safeToFixed } from '@/lib/format-utils';
import type { DateRange } from '@/components/reports';

// ============================================
// FORMATTERS
// ============================================

export const currency = (v: unknown): string =>
  v == null
    ? ''
    : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const numberFmt = (v: unknown): string =>
  v == null ? '' : Number(v).toLocaleString('en-IN');

export const dateFmt = (v: unknown): string =>
  v ? format(new Date(v as string | number | Date), 'yyyy-MM-dd') : '';

export const volumeFmt = (v: unknown): string =>
  v == null ? '' : `${safeToFixed(v)} L`;

// ============================================
// CSV EXPORT FUNCTIONS
// ============================================

interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  formatter?: (v: unknown) => string;
}

export function exportSalesReport<T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  onSuccess?: (filename: string) => void
) {
  const rowsRaw = data.flatMap((r) => {
    const pricePerLiter = r.totalQuantity > 0 ? r.totalSales / r.totalQuantity : 0;
    const mainRow = {
      stationName: r.stationName,
      date: r.date,
      fuelType: 'ALL',
      totalSales: r.totalSales,
      totalQuantity: r.totalQuantity,
      pricePerLiter: pricePerLiter,
      totalTransactions: r.totalTransactions,
    };
    const fuelRows = (Array.isArray(r.fuelTypeSales) ? r.fuelTypeSales : []).map(
      (f: any) => ({
        stationName: r.stationName,
        date: r.date,
        fuelType: f.fuelType,
        totalSales: f.sales,
        totalQuantity: f.quantity,
        pricePerLiter: f.quantity > 0 ? f.sales / f.quantity : 0,
        totalTransactions: f.transactions,
      })
    );
    return [mainRow, ...fuelRows];
  });

  const cols: CsvColumn<typeof rowsRaw[0]>[] = [
    { key: 'stationName', label: 'Station' },
    { key: 'date', label: 'Date', formatter: dateFmt },
    { key: 'fuelType', label: 'Fuel Type' },
    { key: 'totalSales', label: 'Total Sales', formatter: currency },
    { key: 'totalQuantity', label: 'Quantity (L)', formatter: volumeFmt },
    { key: 'pricePerLiter', label: 'Price/Liter', formatter: currency },
    { key: 'totalTransactions', label: 'Transactions', formatter: numberFmt },
  ];

  const csv = toCsv(rowsRaw, cols);
  const filename = `sales_report_${dateRange.startDate}_${dateRange.endDate}.csv`;
  downloadCsv(filename, csv);
  onSuccess?.(filename);
}

export function exportNozzlesReport<T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  onSuccess?: (filename: string) => void
) {
  const rowsRaw = data.map((n: any) => {
    const pricePerLiter = n.totalQuantity > 0 ? n.totalSales / n.totalQuantity : 0;
    return {
      nozzleId: n.nozzleId,
      nozzleNumber: n.nozzleNumber,
      fuelType: n.fuelType,
      pumpName: n.pumpName,
      totalSales: n.totalSales,
      totalQuantity: n.totalQuantity,
      pricePerLiter: pricePerLiter,
      transactions: n.transactions,
    };
  });

  const cols: CsvColumn<typeof rowsRaw[0]>[] = [
    { key: 'nozzleNumber', label: 'Nozzle' },
    { key: 'pumpName', label: 'Pump' },
    { key: 'fuelType', label: 'Fuel' },
    { key: 'totalSales', label: 'Total Sales', formatter: currency },
    { key: 'totalQuantity', label: 'Volume (L)', formatter: volumeFmt },
    { key: 'pricePerLiter', label: 'Price/Liter', formatter: currency },
    { key: 'transactions', label: 'Transactions', formatter: numberFmt },
  ];

  const csv = toCsv(rowsRaw, cols);
  const filename = `nozzles_report_${dateRange.startDate}_${dateRange.endDate}.csv`;
  downloadCsv(filename, csv);
  onSuccess?.(filename);
}

export function exportShiftsReport<T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  onSuccess?: (filename: string) => void
) {
  const rowsRaw = data.map((s: any) => ({
    id: s.id,
    stationName: s.stationName,
    employeeName: s.employeeName,
    startTime: s.startTime,
    endTime: s.endTime,
    openingCash: s.openingCash,
    closingCash: s.closingCash,
    totalSales: s.totalSales,
    cashSales: s.cashSales,
    digitalSales: s.digitalSales,
    status: s.status,
  }));

  const cols: CsvColumn<typeof rowsRaw[0]>[] = [
    { key: 'id', label: 'Shift ID' },
    { key: 'stationName', label: 'Station' },
    { key: 'employeeName', label: 'Employee' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    { key: 'openingCash', label: 'Opening Cash', formatter: currency },
    { key: 'closingCash', label: 'Closing Cash', formatter: currency },
    { key: 'totalSales', label: 'Total Sales', formatter: currency },
    { key: 'status', label: 'Status' },
  ];

  const csv = toCsv(rowsRaw, cols);
  const filename = `shifts_report_${dateRange.startDate}_${dateRange.endDate}.csv`;
  downloadCsv(filename, csv);
  onSuccess?.(filename);
}

export function exportPumpsReport<T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  onSuccess?: (filename: string) => void
) {
  const rowsRaw = data.map((p: any) => ({
    pumpId: p.pumpId,
    pumpName: p.pumpName,
    pumpNumber: p.pumpNumber,
    stationName: p.stationName,
    totalSales: p.totalSales,
    totalQuantity: p.totalQuantity,
    transactions: p.transactions,
  }));

  const cols: CsvColumn<typeof rowsRaw[0]>[] = [
    { key: 'pumpName', label: 'Pump' },
    { key: 'stationName', label: 'Station' },
    { key: 'totalSales', label: 'Total Sales', formatter: currency },
    { key: 'totalQuantity', label: 'Volume (L)', formatter: volumeFmt },
    { key: 'transactions', label: 'Transactions', formatter: numberFmt },
  ];

  const csv = toCsv(rowsRaw, cols);
  const filename = `pumps_report_${dateRange.startDate}_${dateRange.endDate}.csv`;
  downloadCsv(filename, csv);
  onSuccess?.(filename);
}

// ============================================
// PDF/PRINT GENERATION
// ============================================

const printStyles = `
  body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;}
  h1{color:#1a365d;border-bottom:3px solid #3182ce;padding-bottom:10px;}
  h2{color:#2d3748;margin-top:25px;}
  h3{color:#4a5568;margin-top:20px;margin-bottom:10px;}
  table{width:100%;border-collapse:collapse;margin-top:15px;margin-bottom:25px;}
  th,td{border:1px solid #e2e8f0;padding:10px 12px;text-align:left;}
  th{background:#edf2f7;font-weight:600;color:#2d3748;}
  tr:nth-child(even){background:#f7fafc;}
  .summary-box{background:#ebf8ff;border:1px solid #90cdf4;border-radius:8px;padding:15px;margin:15px 0;}
  .summary-row{display:flex;justify-content:space-between;margin:8px 0;}
  .fuel-breakdown{margin-left:20px;font-size:0.95em;}
  .total-row{font-weight:bold;background:#e2e8f0 !important;}
  .header-info{color:#718096;font-size:0.9em;margin-bottom:20px;}
  @media print{body{padding:15px;}}
`;

interface PrintConfig {
  reportType: string;
  dateRange: DateRange;
  onPopupBlocked?: () => void;
}

function createPrintWindow(config: PrintConfig): Window | null {
  const { reportType, dateRange, onPopupBlocked } = config;
  const w = window.open('', '_blank');
  
  if (!w) {
    onPopupBlocked?.();
    return null;
  }

  w.document.write(`<html><head><title>Report - ${reportType}</title>
    <style>${printStyles}</style></head><body>`);
  w.document.write(`<h1>FuelSync Report</h1>`);
  w.document.write(
    `<div class="header-info">Generated: ${format(new Date(), 'PPpp')}<br/>Period: ${dateRange.startDate} to ${dateRange.endDate}</div>`
  );
  w.document.write(
    `<h2>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</h2>`
  );

  return w;
}

function finalizePrintWindow(w: Window) {
  w.document.write(`</body></html>`);
  w.document.close();
  setTimeout(() => {
    w.print();
  }, 500);
}

export function printSalesReport<T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  onPopupBlocked?: () => void
) {
  const w = createPrintWindow({ reportType: 'sales', dateRange, onPopupBlocked });
  if (!w) return;

  const grandTotal = data.reduce(
    (acc, r) => ({
      sales: acc.sales + (r.totalSales || 0),
      quantity: acc.quantity + (r.totalQuantity || 0),
      transactions: acc.transactions + (r.totalTransactions || 0),
    }),
    { sales: 0, quantity: 0, transactions: 0 }
  );

  w.document.write(`<div class="summary-box">
    <strong>Summary</strong>
    <div class="summary-row"><span>Total Sales:</span><span>${currency(grandTotal.sales)}</span></div>
    <div class="summary-row"><span>Total Volume:</span><span>${safeToFixed(grandTotal.quantity)} L</span></div>
    <div class="summary-row"><span>Total Transactions:</span><span>${grandTotal.transactions}</span></div>
  </div>`);

  w.document.write(
    `<table><thead><tr><th>Station</th><th>Date</th><th>Total Sales</th><th>Quantity (L)</th><th>Price/L</th><th>Transactions</th></tr></thead><tbody>`
  );
  
  data.forEach((r) => {
    const pricePerLiter = r.totalQuantity > 0 ? r.totalSales / r.totalQuantity : 0;
    w.document.write(`<tr>
      <td>${r.stationName}</td>
      <td>${dateFmt(r.date)}</td>
      <td>${currency(r.totalSales)}</td>
      <td>${safeToFixed(r.totalQuantity ?? 0)}</td>
      <td>${currency(pricePerLiter)}</td>
      <td><strong>${r.totalTransactions ?? 0}</strong></td>
    </tr>`);

    if (r.fuelTypeSales && r.fuelTypeSales.length > 0) {
      w.document.write(
        `<tr><td colspan="6" class="fuel-breakdown"><strong>Fuel Breakdown:</strong><table style="margin:10px 0;width:95%;margin-left:auto;">
        <thead><tr><th>Fuel Type</th><th>Sales</th><th>Quantity</th><th>Price/L</th><th>Txns</th></tr></thead><tbody>`
      );
      r.fuelTypeSales.forEach((f: any) => {
        const fuelPricePerL = f.quantity > 0 ? f.sales / f.quantity : 0;
        w.document.write(
          `<tr><td>${f.fuelType}</td><td>${currency(f.sales)}</td><td>${safeToFixed(f.quantity)} L</td><td>${currency(fuelPricePerL)}</td><td>${f.transactions}</td></tr>`
        );
      });
      w.document.write(`</tbody></table></td></tr>`);
    }
  });

  w.document.write(
    `<tr class="total-row"><td>TOTAL</td><td></td><td>${currency(grandTotal.sales)}</td><td>${safeToFixed(grandTotal.quantity)}</td><td></td><td>${grandTotal.transactions}</td></tr></tbody></table>`
  );

  finalizePrintWindow(w);
}

export function printNozzlesReport<T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  onPopupBlocked?: () => void
) {
  const w = createPrintWindow({ reportType: 'nozzles', dateRange, onPopupBlocked });
  if (!w) return;

  const grandTotal = data.reduce(
    (acc: any, n: any) => ({
      sales: acc.sales + (n.totalSales || 0),
      quantity: acc.quantity + (n.totalQuantity || 0),
      transactions: acc.transactions + (n.transactions || 0),
    }),
    { sales: 0, quantity: 0, transactions: 0 }
  );

  w.document.write(`<div class="summary-box">
    <strong>Nozzle Summary</strong>
    <div class="summary-row"><span>Total Nozzles:</span><span>${data.length}</span></div>
    <div class="summary-row"><span>Total Sales:</span><span>${currency(grandTotal.sales)}</span></div>
    <div class="summary-row"><span>Total Volume:</span><span>${safeToFixed(grandTotal.quantity)} L</span></div>
    <div class="summary-row"><span>Total Transactions:</span><span>${grandTotal.transactions}</span></div>
  </div>`);

  w.document.write(
    `<table><thead><tr><th>Nozzle</th><th>Pump</th><th>Fuel</th><th>Sales</th><th>Volume (L)</th><th>Price/L</th><th>Txns</th></tr></thead><tbody>`
  );
  
  data.forEach((n: any) => {
    const pricePerL = n.totalQuantity > 0 ? n.totalSales / n.totalQuantity : 0;
    w.document.write(
      `<tr><td>${n.nozzleNumber}</td><td>${n.pumpName}</td><td>${n.fuelType}</td><td>${currency(n.totalSales)}</td><td>${safeToFixed(n.totalQuantity ?? 0)}</td><td>${currency(pricePerL)}</td><td><strong>${n.transactions}</strong></td></tr>`
    );
  });

  w.document.write(`</tbody></table>`);
  finalizePrintWindow(w);
}

export function printShiftsReport<T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  onPopupBlocked?: () => void
) {
  const w = createPrintWindow({ reportType: 'shifts', dateRange, onPopupBlocked });
  if (!w) return;

  w.document.write(
    `<table><thead><tr><th>Shift ID</th><th>Station</th><th>Employee</th><th>Start</th><th>End</th><th>Opening</th><th>Closing</th><th>Total Sales</th></tr></thead><tbody>`
  );
  
  data.forEach((s: any) => {
    w.document.write(
      `<tr><td>${s.id}</td><td>${s.stationName}</td><td>${s.employeeName}</td><td>${s.startTime}</td><td>${s.endTime || ''}</td><td>${currency(s.openingCash)}</td><td>${currency(s.closingCash)}</td><td>${currency(s.totalSales)}</td></tr>`
    );
  });

  w.document.write(`</tbody></table>`);
  finalizePrintWindow(w);
}

export function printPumpsReport<T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  onPopupBlocked?: () => void
) {
  const w = createPrintWindow({ reportType: 'pumps', dateRange, onPopupBlocked });
  if (!w) return;

  w.document.write(
    `<table><thead><tr><th>Pump</th><th>Station</th><th>Sales</th><th>Volume</th><th>Txns</th></tr></thead><tbody>`
  );
  
  data.forEach((p: any) => {
    w.document.write(
      `<tr><td>${p.pumpName} (${p.pumpNumber})</td><td>${p.stationName}</td><td>${currency(p.totalSales)}</td><td>${safeToFixed(p.totalQuantity ?? 0)}</td><td>${p.transactions}</td></tr>`
    );
  });

  w.document.write(`</tbody></table>`);
  finalizePrintWindow(w);
}
