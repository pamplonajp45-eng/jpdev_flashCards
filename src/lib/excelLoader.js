import * as XLSX from 'xlsx';

/**
 * Loads vocabulary from an Excel file located in the assets/excels folder.
 * @param {string} lessonFile - The name of the file in src/assets/excels/
 * @returns {Promise<Array>} - Array of card objects { front, back }
 */
export async function loadLessonFromExcel(lessonFile) {
  try {
    // In Vite, we can fetch from the public path if we store it there, 
    // but since it's in src/assets/excels, let's assume it's served or we use dynamic import.
    // However, the easiest way for now is to fetch it if Vite serves the assets.
    // Or we can import it if we know the path.

    // Using fetch on the relative path from the app root
    const response = await fetch(`/src/assets/excels/${lessonFile}`);
    const arrayBuffer = await response.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON
    // Expected format: Column A: Front (Japanese), Column B: Back (Meaning)
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Map to card format, skipping header if necessary
    // We'll filter out empty rows
    const cards = data.slice(1)
      .filter(row => row && row[0] && row[3])
      .map(row => ({
        front: String(row[0]).trim(),
        back: String(row[3]).trim()
      }));

    return cards;
  } catch (error) {
    console.error("Error loading Excel file:", error);
    throw error;
  }
}
