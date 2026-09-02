import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CNERecord, SessionUser } from '../types';

export function generateAnnualCNEPdf(
  user: SessionUser,
  records: CNERecord[],
  year: number
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Calculate totals
  let totalMinutes = 0;
  records.forEach((rec) => {
    const parts = (rec.duration || '1:00:00').split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    totalMinutes += hours * 60 + mins;
  });

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  const durationSummaryStr = `${totalHours} Hour${totalHours === 1 ? '' : 's'} ${remainingMins} Min${remainingMins === 1 ? '' : 's'}`;

  // Institutional Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('ALL INDIA INSTITUTE OF MEDICAL SCIENCES, RISHIKESH', 105, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('DEPARTMENT OF NURSING SERVICES — CLINICAL NURSING EDUCATION (CNE)', 105, 24, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`ANNUAL CNE PARTICIPATION RECORD (${year})`, 105, 32, { align: 'center' });

  // Divider Line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 36, 196, 36);

  // Employee Meta Details Grid
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, 40, 182, 26, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 40, 182, 26, 2, 2, 'D');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Employee Name:', 18, 47);
  doc.text('Employee ID No:', 18, 55);
  doc.text('Designation:', 18, 62);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(user.name || 'N/A', 54, 47);
  doc.text(user.employeeId || 'N/A', 54, 55);
  doc.text(user.designation || 'N/A', 54, 62);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Assessment Year:', 120, 47);
  doc.text('Generated Date:', 120, 55);
  doc.text('Total Sessions:', 120, 62);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${year}`, 156, 47);
  doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 156, 55);
  doc.text(`${records.length} Activity / Activities`, 156, 62);

  // Table Data Preparation
  const tableData = records.map((rec, index) => {
    const isResourcePerson = rec.resourcePersonEmpId.toLowerCase() === user.employeeId.toLowerCase();
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
    startY: 72,
    head: [['Sr', 'Date', 'Area / Ward', 'CNE Topic / Skills', 'Mode', 'Role', 'Duration']],
    body: tableData.length > 0 ? tableData : [['-', '-', 'No CNE activities recorded for this year', '-', '-', '-', '-']],
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
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 54 },
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

  // Summary Metrics & Signatures
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const pageHeight = doc.internal.pageSize.getHeight();

  // If close to page bottom, add new page
  if (finalY > pageHeight - 45) {
    doc.addPage();
  }

  const summaryY = finalY > pageHeight - 45 ? 20 : finalY;

  // Summary Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, summaryY, 182, 16, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, summaryY, 182, 16, 2, 2, 'D');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Total CNE Activities Attended / Conducted: ${records.length}`, 20, summaryY + 10);
  doc.text(`Total Training Duration: ${durationSummaryStr}`, 115, summaryY + 10);

  // Signatures
  const sigY = summaryY + 32;
  doc.setFontSize(8.5);
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
  const cleanName = (user.name || 'Officer').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`CNE_Annual_Record_${user.employeeId}_${year}_${cleanName}.pdf`);
}
