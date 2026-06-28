const EXPORT_COLUMNS = [
  { key: 'house_no',        label: 'House No' },
  { key: 'name',            label: 'Name' },
  { key: 'mobile',          label: 'Mobile' },
  { key: 'village',         label: 'Village' },
  { key: 'area',            label: 'Area' },
  { key: 'formation',       label: 'Formation' },
  { key: 'unit',            label: 'Unit' },
  { key: 'occupation',      label: 'Occupation' },
  { key: 'community',       label: 'Community' },
  { key: 'religion',        label: 'Religion' },
  { key: 'salary',          label: 'Salary' },
  { key: 'income',          label: 'Income' },
  { key: 'expenditure',     label: 'Expenditure' },
  { key: 'health_status',   label: 'Health Status' },
  { key: 'created_at',      label: 'Created' },
];

function fmtExportDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : '';
}

function recordToRow(record) {
  return EXPORT_COLUMNS.map(({ key }) => {
    if (key === 'created_at') return fmtExportDate(record.created_at);
    if (key === 'salary' || key === 'income' || key === 'expenditure') return fmtMoney(record[key]);
    return record[key] ?? '';
  });
}

function recordToSheetRow(record) {
  const row = {};
  for (const { key, label } of EXPORT_COLUMNS) {
    if (key === 'created_at') row[label] = fmtExportDate(record.created_at);
    else if (key === 'salary' || key === 'income' || key === 'expenditure') row[label] = fmtMoney(record[key]);
    else row[label] = record[key] ?? '';
  }
  return row;
}

function buildFilename(ext, filterLabel) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = filterLabel && filterLabel !== 'All records'
    ? '-filtered'
    : '';
  return `civilian-records${slug}-${date}.${ext}`;
}

export async function exportViewDataExcel(records, { filterLabel = 'All records', searchQuery = '' } = {}) {
  const XLSX = await import('xlsx');
  const sheetRows = records.map(recordToSheetRow);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);

  const meta = [
    ['Digital Demographic Profiling — Civilian Records'],
    ['Exported', new Date().toLocaleString('en-GB')],
    ['Filters', filterLabel],
    ['Search', searchQuery || '—'],
    ['Total records', records.length],
    [],
  ];

  const metaSheet = XLSX.utils.aoa_to_sheet(meta);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Records');
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Export Info');
  XLSX.writeFile(workbook, buildFilename('xlsx', filterLabel));
}

export async function exportViewDataPdf(records, { filterLabel = 'All records', searchQuery = '' } = {}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headers = EXPORT_COLUMNS.map(c => c.label);
  const body = records.map(recordToRow);

  doc.setFontSize(14);
  doc.text('Digital Demographic Profiling — Civilian Records', 14, 14);

  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`Exported: ${new Date().toLocaleString('en-GB')}`, 14, 21);
  doc.text(`Filters: ${filterLabel}`, 14, 26);
  doc.text(`Search: ${searchQuery || '—'}`, 14, 31);
  doc.text(`Total records: ${records.length}`, 14, 36);
  doc.setTextColor(0);

  autoTable(doc, {
    head: [headers],
    body,
    startY: 42,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  doc.save(buildFilename('pdf', filterLabel));
}
