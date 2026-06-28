const EXPORT_COLUMNS = [
  { key: 'id',                  label: 'Record ID' },
  { key: 'house_no',            label: 'House No' },
  { key: 'name',                label: 'Name' },
  { key: 'mobile',              label: 'Mobile' },
  { key: 'village',             label: 'Village' },
  { key: 'area',                label: 'Area' },
  { key: 'formation',           label: 'Formation' },
  { key: 'unit',                label: 'Unit' },
  { key: 'occupation',          label: 'Occupation' },
  { key: 'community',           label: 'Community' },
  { key: 'religion',            label: 'Religion' },
  { key: 'immovable_property',  label: 'Immovable Property' },
  { key: 'movable_property',    label: 'Movable Property' },
  { key: 'salary',              label: 'Salary', type: 'money' },
  { key: 'income',              label: 'Income', type: 'money' },
  { key: 'expenditure',         label: 'Expenditure', type: 'money' },
  { key: 'lat',                 label: 'Latitude', type: 'coord' },
  { key: 'lng',                 label: 'Longitude', type: 'coord' },
  { key: 'plot_boundary',       label: 'Plot Boundary', type: 'polygon' },
  { key: 'family_details',      label: 'Family Details', type: 'family' },
  { key: 'document_attached',   label: 'Document Attached', type: 'document' },
  { key: 'created_by',          label: 'Created By' },
  { key: 'created_at',          label: 'Created', type: 'date' },
];

function fmtExportDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : '';
}

function fmtCoord(v) {
  if (v == null || v === '') return '';
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(6) : '';
}

function fmtFamily(raw) {
  let members = [];
  try {
    members = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
  } catch {
    return '';
  }
  if (!members.length) return '';
  return members.map((m, i) => {
    const bits = [
      m.name,
      m.relation || null,
      m.age ? `Age ${m.age}` : null,
      m.occupation || null,
      m.remarks || null,
    ].filter(Boolean);
    return `${i + 1}. ${bits.join(', ')}`;
  }).join('; ');
}

function hasPolygon(raw) {
  if (!raw) return '';
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed ? 'Yes' : '';
  } catch {
    return '';
  }
}

function fmtDocument(path) {
  return path ? 'Yes' : '';
}

function exportValue(record, col) {
  switch (col.type) {
    case 'date':
      return fmtExportDate(record[col.key]);
    case 'money':
      return fmtMoney(record[col.key]);
    case 'coord':
      return fmtCoord(record[col.key]);
    case 'family':
      return fmtFamily(record.family_details);
    case 'polygon':
      return hasPolygon(record.polygon);
    case 'document':
      return fmtDocument(record.document_path);
    default:
      return record[col.key] ?? '';
  }
}

function recordToRow(record) {
  return EXPORT_COLUMNS.map(col => exportValue(record, col));
}

function recordToSheetRow(record) {
  const row = {};
  for (const col of EXPORT_COLUMNS) {
    row[col.label] = exportValue(record, col);
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
    ['Note', 'Photos are not included. Document column indicates attachment only.'],
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
  doc.text('Photos not included — document column shows attachment only.', 14, 41);
  doc.setTextColor(0);

  autoTable(doc, {
    head: [headers],
    body,
    startY: 46,
    styles: { fontSize: 5.5, cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold', fontSize: 5.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 8, right: 8 },
    tableWidth: 'auto',
  });

  doc.save(buildFilename('pdf', filterLabel));
}
