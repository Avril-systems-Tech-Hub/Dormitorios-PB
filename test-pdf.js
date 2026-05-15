const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function run() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 600]);

  try {
    const imagePath = path.join(process.cwd(), "public", "logo-dorm.png");
    const imageBytes = fs.readFileSync(imagePath);
    console.log("Image read correctly, size:", imageBytes.length);
    const image = await pdfDoc.embedPng(imageBytes);
    console.log("Image embedded successfully");
  } catch (e) {
    console.error("No se pudo cargar el logo:", e);
  }
}
run();
