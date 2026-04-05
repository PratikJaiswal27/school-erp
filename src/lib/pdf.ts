import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Student {
  name: string;
  class_name: string;
  roll_number: string;
  father_name: string;
  mother_name: string;
  dob: string;
  gender: string;
}

interface ReportCard {
  exam_name: string;
  academic_year: string;
}

interface Mark {
  subject: string;
  max_marks: number;
  marks_obtained: number;
  grade: string;
  remarks?: string;
}

interface Attendance {
  present: number;
  absent: number;
  percentage: number;
}

interface SchoolSettings {
  logo_url?: string;
  principal_name: string;
  principal_signature_text: string;
  school_stamp_text: string;
  school_address?: string; // NEW
}

// Helper to convert URL to base64 (for images)
const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export async function generateReportCardPDF(
  student: Student,
  reportCard: ReportCard,
  marks: Mark[],
  attendance: Attendance,
  settings: SchoolSettings
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;

  // Header with blue background
  doc.setFillColor(13, 110, 253);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // School logo
  if (settings.logo_url) {
    try {
      const base64 = await urlToBase64(settings.logo_url);
      doc.addImage(base64, 'PNG', 10, 8, 20, 20);
    } catch (e) {
      // Fallback: draw a circle with "SG"
      doc.setFillColor(255, 255, 255);
      doc.circle(20, 18, 10, 'F');
      doc.setTextColor(13, 110, 253);
      doc.setFontSize(10);
      doc.text('SG', 17, 21);
    }
  } else {
    // Fallback
    doc.setFillColor(255, 255, 255);
    doc.circle(20, 18, 10, 'F');
    doc.setTextColor(13, 110, 253);
    doc.setFontSize(10);
    doc.text('SG', 17, 21);
  }

  // School name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SHREE GURU NANAK PUBLIC SCHOOL', pageWidth / 2, 18, { align: 'center' });
  
  // School address (if provided)
  if (settings.school_address) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.school_address, pageWidth / 2, 25, { align: 'center' });
  }
  
  // Report Card title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Report Card', pageWidth / 2, 32, { align: 'center' });

  // Student info box
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setDrawColor(13, 110, 253);
  doc.rect(10, 45, pageWidth - 20, 35);
  doc.text(`Name: ${student.name}`, 15, 55);
  doc.text(`Class: ${student.class_name}`, 80, 55);
  doc.text(`Roll No: ${student.roll_number}`, 150, 55);
  doc.text(`Father: ${student.father_name}`, 15, 63);
  doc.text(`Mother: ${student.mother_name}`, 80, 63);
  doc.text(`DOB: ${student.dob}`, 150, 63);
  doc.text(`Exam: ${reportCard.exam_name}`, 15, 71);
  doc.text(`Year: ${reportCard.academic_year}`, 80, 71);
  doc.text(`Gender: ${student.gender}`, 150, 71);

  // Marks table
  const tableData = marks.map(m => [
    m.subject,
    m.max_marks,
    m.marks_obtained,
    m.grade,
    m.remarks || ''
  ]);
  // Add total row
  const totalMax = marks.reduce((s, m) => s + m.max_marks, 0);
  const totalObtained = marks.reduce((s, m) => s + m.marks_obtained, 0);
  const totalPct = totalMax === 0 ? 0 : ((totalObtained / totalMax) * 100).toFixed(1);
  tableData.push(['TOTAL', totalMax, totalObtained, totalPct + '%', '']);

  autoTable(doc, {
    startY: 85,
    head: [['Subject', 'Max Marks', 'Obtained', 'Grade', 'Remarks']],
    body: tableData,
    alternateRowStyles: { fillColor: [232, 244, 253] },
    headStyles: { fillColor: [13, 110, 253], textColor: [255, 255, 255] },
    didDrawCell: (data) => {
      if (data.column.index === 3 && data.section === 'body') {
        const grade = data.cell.text[0];
        if (['A+', 'A'].includes(grade)) doc.setTextColor(0, 128, 0);
        else if (grade === 'B') doc.setTextColor(184, 134, 11);
        else if (['C', 'D'].includes(grade)) doc.setTextColor(255, 140, 0);
        else if (grade === 'F') doc.setTextColor(220, 53, 69);
      }
    }
  });

  // Attendance box
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFillColor(240, 248, 255);
  doc.rect(10, finalY, pageWidth - 20, 15, 'F');
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Attendance — Present: ${attendance.present} days | Absent: ${attendance.absent} days | Percentage: ${attendance.percentage}%`,
    pageWidth / 2,
    finalY + 9,
    { align: 'center' }
  );

  // Signature section
  const sigY = finalY + 30;
  doc.setDrawColor(0);
  // Left: stamp
  doc.line(15, sigY, 85, sigY);
  doc.text(settings.school_stamp_text || 'School Stamp', 50, sigY + 8, { align: 'center' });
  doc.text('School Stamp', 50, sigY + 14, { align: 'center' });
  // Right: principal
  doc.line(125, sigY, 195, sigY);
  doc.text(settings.principal_name || 'Principal', 160, sigY + 8, { align: 'center' });
  doc.text(settings.principal_signature_text || 'Principal, SGNPS', 160, sigY + 14, { align: 'center' });

  // Return as Blob
  return doc.output('blob');
}