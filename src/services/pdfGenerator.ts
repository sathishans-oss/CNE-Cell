import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CNERecord, SessionUser } from '../types';

export function generateAnnualCNEPdf(
  user: SessionUser,
  records: CNERecord[],
  year: number | string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Normalize Assessment Year string (e.g., 2026 -> "2026–2027" if single year passed, or preserve "2026–2027")
  const ayStr = typeof year === 'number'
    ? `${year}–${year + 1}`
    : (year.includes('–') || year.includes('-') ? year.replace('-', '–') : `${year}–${parseInt(year, 10) + 1}`);

  // Calculate totals accurately
  let totalMinutes = 0;
  records.forEach((rec) => {
    const parts = (rec.duration || '1:00:00').split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    totalMinutes += hours * 60 + mins;
  });

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  const durationSummaryStr = remainingMins > 0 
    ? `${totalHours} Hours ${remainingMins} Mins`
    : `${totalHours} Hours`;

  // 1. Institutional Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('ALL INDIA INSTITUTE OF MEDICAL SCIENCES, RISHIKESH', 105, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('DEPARTMENT OF NURSING SERVICES — CLINICAL NURSING EDUCATION (CNE)', 105, 22, { align: 'center' });

  // 2. Professional PDF Document Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('ANNUAL CONTINUING NURSING EDUCATION (CNE) RECORD', 105, 30, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Assessment Year: ${ayStr}`, 105, 36, { align: 'center' });

  // Top Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 40, 196, 40);

  // 3. EMPLOYEE INFORMATION SECTION (With Summary Metrics inside)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, 44, 182, 34, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 44, 182, 34, 2, 2, 'D');

  // Section Header inside card
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('EMPLOYEE INFORMATION & ANNUAL SUMMARY', 18, 50);

  // Left Column: Employee Identity
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Employee Name:', 18, 57);
  doc.text('Employee ID:', 18, 64);
  doc.text('Designation:', 18, 71);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(user.name || 'N/A', 50, 57);
  doc.text(user.employeeId || 'N/A', 50, 64);
  doc.text(user.designation || 'N/A', 50, 71);

  // Right Column: Summary Metrics (Total Activities & Duration ABOVE Table)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Assessment Year:', 110, 57);
  doc.text('Total CNE Activities:', 110, 64);
  doc.text('Total Training Duration:', 110, 71);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${ayStr}`, 154, 57);
  doc.text(`${records.length} Activities`, 154, 64);
  doc.text(`${durationSummaryStr}`, 154, 71);

  // 4. CNE ACTIVITY DETAILS Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('CNE ACTIVITY DETAILS', 14, 84);

  // Table Data Preparation
  const tableData = records.map((rec, index) => {
    const isResourcePerson = (rec.resourcePersonEmpId || '').toLowerCase().includes((user.employeeId || '').toLowerCase());
    const roleLabel = isResourcePerson ? 'Resource Person' : 'Participant';
    const dateDisplay = rec.toDate && rec.toDate !== rec.fromDate 
      ? `${rec.fromDate} to ${rec.toDate}` 
      : rec.fromDate;

    return [
      (index + 1).toString(),
      dateDisplay,
      rec.area || 'General',
      rec.topic || 'Clinical Nursing Topic',
      rec.modeOfTeaching || 'Lecture',
      roleLabel,
      rec.duration || '1:00:00'
    ];
  });

  autoTable(doc, {
    startY: 87,
    head: [['Sr', 'Date / Period', 'Area / Ward', 'CNE Topic / Skills', 'Mode', 'Role', 'Duration']],
    body: tableData.length > 0 ? tableData : [['-', '-', 'No CNE activities recorded for this assessment year', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 52 },
      4: { cellWidth: 26 },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' }
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  // Signatures Section
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const pageHeight = doc.internal.pageSize.getHeight();

  // If close to page bottom, add new page
  if (finalY > pageHeight - 40) {
    doc.addPage();
  }

  const sigY = finalY > pageHeight - 40 ? 30 : finalY;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.line(16, sigY, 68, sigY);
  doc.text('Signature of Nursing Officer', 16, sigY + 5);
  doc.text(`(${user.name || 'Officer'})`, 16, sigY + 9);

  doc.line(76, sigY, 130, sigY);
  doc.text('Signature of CNE Coordinator', 76, sigY + 5);
  doc.text('(Ms. Suman Choudhary / Ms. Ramya T)', 76, sigY + 9);

  doc.line(138, sigY, 194, sigY);
  doc.text('Chairperson, CNE Committee / CNO', 138, sigY + 5);
  doc.text('AIIMS Rishikesh', 138, sigY + 9);

  // Footer / Verification Stamp
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This is a verified institutional record from the Clinical Nursing Education (CNE) Portal • AIIMS Rishikesh.', 105, pageHeight - 8, { align: 'center' });

  // Trigger download
  const cleanAy = ayStr.replace(/[^a-zA-Z0-9-]/g, '_');
  const cleanName = (user.name || 'Officer').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`CNE_Annual_Record_${user.employeeId}_AY_${cleanAy}_${cleanName}.pdf`);
}
