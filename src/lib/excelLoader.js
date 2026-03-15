import * as XLSX from 'xlsx';

/**
 * Loads vocabulary from an Excel file located in the assets/excels folder.
 * @param {string} lessonFile - The name of the file in src/assets/excels/
 * @returns {Promise<Array>} - Array of card objects { front, back }
 */
export async function loadLessonFromExcel(lessonFile) {
  try {
    const response = await fetch(`/excels/${lessonFile}`);
    const arrayBuffer = await response.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    let cards = [];

    if (lessonFile.includes("hiragana") || lessonFile.includes("katakana")) {
      // Structure: [Kana, Romaji, Kana, Romaji, Kana, Romaji, Kana, Romaji, Kana, Romaji]
      // Some rows are just section headers (length 1)
      data.slice(1).forEach(row => {
        if (!row || row.length < 2) return;
        for (let i = 0; i < row.length; i += 2) {
          if (row[i] && row[i + 1]) {
            cards.push({
              front: String(row[i]).trim(),
              back: String(row[i + 1]).trim()
            });
          }
        }
      });
    } else {
      // Minna no Nihongo expected format: Column A: Front, Column D: Back
      cards = data.slice(1)
        .filter(row => row && row[0] && row[3])
        .map(row => ({
          front: String(row[0]).trim(),
          back: String(row[3]).trim()
        }));
    }

    return cards;
  } catch (error) {
    console.error("Error loading Excel file:", error);
    throw error;
  }
}
