import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { listAdminDashboardData } from './store';

type Bundles = Awaited<ReturnType<typeof listAdminDashboardData>>['bundles'];

export async function exportAdminWorkbook(bundles: Bundles): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Srusti Tournament Administration';
  const teams = workbook.addWorksheet('Registrations');
  const players = workbook.addWorksheet('Players');
  teams.addRow(['Team code', 'Team', 'Event', 'College', 'Status', 'Group', 'Slot', 'Captain phone', 'Captain email', 'Fee (INR)', 'Lunch meals', 'Veg', 'Non-veg', 'Latest UTR', 'Registered (IST)']);
  players.addRow(['Team code', 'Team', 'Role', 'Player name', 'In-game name', 'Character ID', 'Lunch', 'Diet']);
  for (const { registration: r, event, members, proofs } of bundles) {
    // Explicit columns exclude internal UUIDs, storage paths and authentication data.
    teams.addRow([r.teamCode, r.teamName, event.title, r.collegeName, r.status, r.groupName || '', r.slotNumber || '', r.iglPhone, r.iglEmail, r.totalFee, r.lunchCount, r.vegCount, r.nonVegCount, proofs[0]?.utrNumber || '', new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]);
    for (const m of members) players.addRow([r.teamCode, r.teamName, m.slotRole, m.fullName, m.inGameName, m.characterId, m.wantsLunch ? 'Yes' : 'No', m.dietType]);
  }
  for (const sheet of [teams, players]) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF233D8B' } };
    sheet.columns.forEach(column => { column.width = 24; column.alignment = { vertical: 'top', wrapText: true }; });
    sheet.getRow(1).height = 30;
  }
  // Strings are literal XLSX values, never formula objects (including IDs beginning with =).
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function exportAdminPdf(bundles: Bundles): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(20).fillColor('#233D8B').text('Srusti Tournament Registrations');
    doc.fontSize(10).fillColor('#333333').text(`${bundles.length} matching teams | Generated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    doc.moveDown().text('Private administrator report. Contains registration and roster information.');
    if (!bundles.length) doc.moveDown().text('No registrations match these filters.');
    for (const { registration: r, event, members, proofs } of bundles) {
      doc.addPage();
      doc.fontSize(18).fillColor('#233D8B').text(`${r.teamCode} - ${r.teamName}`);
      doc.moveDown().fontSize(11).fillColor('#222222');
      for (const line of [event.title, `College: ${r.collegeName}`, `Status: ${r.status} | Group: ${r.groupName || '-'} | Slot: ${r.slotNumber || '-'}`, `Captain: ${r.iglEmail} | ${r.iglPhone}`, `Fee: INR ${r.totalFee} | Lunch: ${r.vegCount} veg / ${r.nonVegCount} non-veg`, `UTR: ${proofs[0]?.utrNumber || '-'}`]) doc.text(line).moveDown(0.5);
      doc.moveDown().fontSize(14).text('Squad roster').moveDown(0.5).fontSize(11);
      for (const m of members) doc.text(`${m.slotRole}: ${m.fullName}\nIGN: ${m.inGameName} | Character ID: ${m.characterId}\nLunch: ${m.wantsLunch ? m.dietType : 'No'}`).moveDown();
    }
    doc.end();
  });
}
