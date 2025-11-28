
/**
 * Enhanced OCR parser for fuel pump meter readings
 * Extracts pump serial number, date/time, and nozzle readings from OCR text
 */

function parseOcrText(ocrText) {
  console.log('🔍 Starting OCR text parsing...');
  console.log('Raw OCR text:', ocrText);

  const lines = ocrText.split('\n').map(line => line.trim()).filter(Boolean);
  
  let pump_sno = null;
  let date = null;
  let time = null;
  const nozzleReadings = [];

  // Enhanced regex patterns for better matching
  const nozzleRegex = /(?:Nozzle\s*(?:No\.?\s*)?|^)(\d)[\s:=-]+(\d{2,8}(?:\.\d{1,3})?)/i;
  const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/;
  const timeRegex = /(\d{1,2}[:.]\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i;
  const pumpSnoRegex = /(?:Pump\s*(?:S\.?No\.?|Serial|ID)?[:\-]?\s*|^)(\d{4,})/i;

  console.log('📝 Processing', lines.length, 'lines of OCR text');

  for (const line of lines) {
    console.log('Processing line:', line);

    // Extract Pump Serial Number
    if (!pump_sno) {
      const pumpMatch = line.match(pumpSnoRegex);
      if (pumpMatch) {
        pump_sno = pumpMatch[1];
        console.log('✅ Found pump S.No:', pump_sno);
      }
    }

    // Extract Date
    if (!date) {
      const dateMatch = line.match(dateRegex);
      if (dateMatch) {
        const parts = dateMatch[1].split(/[\/\-\.]/);
        // Handle different date formats (DD/MM/YYYY, MM/DD/YYYY, etc.)
        if (parts.length === 3) {
          const [p1, p2, p3] = parts;
          // Assume DD/MM/YYYY format for Indian fuel stations
          date = `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
          console.log('✅ Found date:', date, 'from', dateMatch[1]);
        }
      }
    }

    // Extract Time
    if (!time) {
      const timeMatch = line.match(timeRegex);
      if (timeMatch) {
        time = timeMatch[1].replace('.', ':');
        // Convert 12-hour to 24-hour format if needed
        if (time.includes('PM') && !time.startsWith('12')) {
          const hour = parseInt(time.split(':')[0]) + 12;
          time = time.replace(/\d+/, hour.toString()).replace(/\s*PM/i, '');
        } else if (time.includes('AM') && time.startsWith('12')) {
          time = time.replace('12', '00').replace(/\s*AM/i, '');
        }
        time = time.replace(/\s*[AP]M/i, '');
        console.log('✅ Found time:', time);
      }
    }

    // Extract Nozzle Readings
    const nozzleMatch = line.match(nozzleRegex);
    if (nozzleMatch) {
      const nozzle_id = parseInt(nozzleMatch[1]);
      const cumulative_volume = parseFloat(nozzleMatch[2]);
      
      if (!isNaN(nozzle_id) && !isNaN(cumulative_volume) && cumulative_volume > 0) {
        // Avoid duplicates
        const existing = nozzleReadings.find(r => r.nozzle_id === nozzle_id);
        if (!existing) {
          nozzleReadings.push({ nozzle_id, cumulative_volume });
          console.log('✅ Found nozzle reading:', { nozzle_id, cumulative_volume });
        }
      }
    }
  }

  const result = {
    pump_sno,
    date,
    time,
    nozzleReadings
  };

  console.log('🎯 OCR parsing complete:', result);

  // Validation
  if (!pump_sno) {
    console.error('❌ No pump serial number found in OCR text');
  }
  if (nozzleReadings.length === 0) {
    console.error('❌ No nozzle readings found in OCR text');
  }

  return result;
}

module.exports = { parseOcrText };
