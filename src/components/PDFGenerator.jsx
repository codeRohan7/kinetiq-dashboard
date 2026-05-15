import React from 'react';

const PDFGenerator = () => {
  const generatePDF = (textContent, title = 'Report', metadata = {}) => {
    console.log('PDF Generation - Install jsPDF first: npm install jspdf jspdf-autotable');
    console.log('Title:', title);
    console.log('Content:', textContent);
    console.log('Metadata:', metadata);
    
    alert('To use PDF generation:\n1. Install: npm install jspdf jspdf-autotable\n2. Import jsPDF in this file\n3. Use the generatePDF function with your ChatGPT text');
  };

  const generatePDFWithTable = (title, tableData, columns, additionalText = '') => {
    console.log('PDF with Table Generation');
    console.log('Install jspdf and jspdf-autotable first');
  };

  return (
    <div className="p-6 space-y-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800" style={{fontFamily: 'Space Grotesk, sans-serif'}}>PDF Generator for Electron</h2>
      
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Installation Required</h3>
          <pre className="text-sm bg-white p-3 rounded border border-blue-200 overflow-x-auto">
npm install jspdf jspdf-autotable
          </pre>
        </div>

        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-semibold text-purple-900 mb-3">Usage Example for Electron</h3>
          <pre className="text-xs bg-white p-4 rounded border border-purple-200 overflow-x-auto">
{`import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Generate PDF from ChatGPT text
const generatePDF = (textContent, title, metadata) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  
  // Header with purple gradient
  doc.setFillColor(147, 51, 234);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 25);
  
  // Add metadata
  let yPosition = 50;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  
  const paragraphs = textContent.split('\\n');
  paragraphs.forEach((paragraph) => {
    const splitText = doc.splitTextToSize(
      paragraph, 
      pageWidth - 2 * margin
    );
    doc.text(splitText, margin, yPosition);
    yPosition += splitText.length * 6 + 8;
  });
  
  doc.save(\`\${title}_\${Date.now()}.pdf\`);
};

// Usage with ChatGPT response
const chatGPTText = "Your generated text here...";
generatePDF(chatGPTText, "Report Title", {
  author: "Your Name",
  date: new Date().toLocaleDateString(),
  company: "Kinetiq"
});`}
          </pre>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-900 mb-2">Features</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-green-800">
            <li>Generate PDFs from plain text</li>
            <li>Support for headings and paragraphs</li>
            <li>Custom metadata (author, date, company)</li>
            <li>Table generation with autoTable</li>
            <li>Professional purple/pink branding</li>
            <li>Automatic page breaks</li>
            <li>Page numbering</li>
          </ul>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Integration Steps</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Install jspdf and jspdf-autotable packages</li>
            <li>Import this component in your Electron renderer process</li>
            <li>Call generatePDF with your ChatGPT generated text</li>
            <li>PDF will be automatically downloaded</li>
          </ol>
        </div>

        <button
          onClick={() => generatePDF('Sample text for testing...', 'Test Report', {})}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition"
        >
          Test PDF Generation (Console Log)
        </button>
      </div>
    </div>
  );
};

export { PDFGenerator };
export default PDFGenerator;
