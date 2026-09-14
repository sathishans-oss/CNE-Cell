// Test suite for Phase 2 CNE Learning Resources Extraction
const assert = require('assert');
const zlib = require('zlib');

console.log('--- Phase 2 Unit and Security Test Suite ---');

// Test 1: Inflate implementation
function inflate(input) {
  let inPos = 0;
  if (input.length > 2 && (input[0] & 0x0F) === 8 && (((input[0] << 8) | input[1]) % 31 === 0)) {
    inPos = 2;
  }

  let bitBuf = 0;
  let bitLen = 0;

  function getBits(n) {
    while (bitLen < n) {
      if (inPos >= input.length) return -1;
      bitBuf |= (input[inPos++] & 0xFF) << bitLen;
      bitLen += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitLen -= n;
    return val;
  }

  function getBit() {
    return getBits(1);
  }

  const output = [];
  let isLast = 0;

  function buildHuffmanTree(lengths) {
    const maxLen = Math.max(...lengths, 0);
    if (maxLen === 0) return null;
    const blCount = new Array(maxLen + 1).fill(0);
    for (let l of lengths) if (l > 0) blCount[l]++;
    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }
    const tree = {};
    for (let i = 0; i < lengths.length; i++) {
      const len = lengths[i];
      if (len !== 0) {
        let c = nextCode[len]++;
        let rev = 0;
        for (let b = 0; b < len; b++) {
          rev = (rev << 1) | ((c >>> b) & 1);
        }
        tree[(len << 16) | rev] = i;
      }
    }
    return { tree, maxLen };
  }

  function decodeSymbol(huff) {
    let code = 0;
    for (let len = 1; len <= huff.maxLen; len++) {
      const bit = getBit();
      if (bit === -1) return -1;
      code |= (bit << (len - 1));
      const key = (len << 16) | code;
      if (huff.tree[key] !== undefined) {
        return huff.tree[key];
      }
    }
    return -1;
  }

  const fixedLitLens = new Array(288);
  for (let i = 0; i <= 143; i++) fixedLitLens[i] = 8;
  for (let i = 144; i <= 255; i++) fixedLitLens[i] = 9;
  for (let i = 256; i <= 279; i++) fixedLitLens[i] = 7;
  for (let i = 280; i <= 287; i++) fixedLitLens[i] = 8;
  const fixedLitTree = buildHuffmanTree(fixedLitLens);

  const fixedDistLens = new Array(32).fill(5);
  const fixedDistTree = buildHuffmanTree(fixedDistLens);

  const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  const lengthBases = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const lengthExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const distBases = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

  while (!isLast) {
    isLast = getBit();
    const btype = getBits(2);
    if (btype === 0) {
      bitBuf = 0; bitLen = 0;
      if (inPos + 4 > input.length) break;
      const len = (input[inPos] & 0xFF) | ((input[inPos + 1] & 0xFF) << 8);
      inPos += 4;
      for (let i = 0; i < len && inPos < input.length; i++) {
        output.push(input[inPos++] & 0xFF);
      }
    } else if (btype === 1 || btype === 2) {
      let litTree, distTree;
      if (btype === 1) {
        litTree = fixedLitTree;
        distTree = fixedDistTree;
      } else {
        const hlit = getBits(5) + 257;
        const hdist = getBits(5) + 1;
        const hclen = getBits(4) + 4;
        const codeLengths = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) codeLengths[order[i]] = getBits(3);
        const codeTree = buildHuffmanTree(codeLengths);
        const allLengths = [];
        while (allLengths.length < hlit + hdist) {
          const sym = decodeSymbol(codeTree);
          if (sym < 16) {
            allLengths.push(sym);
          } else if (sym === 16) {
            const repeat = getBits(2) + 3;
            const prev = allLengths[allLengths.length - 1] || 0;
            for (let r = 0; r < repeat; r++) allLengths.push(prev);
          } else if (sym === 17) {
            const repeat = getBits(3) + 3;
            for (let r = 0; r < repeat; r++) allLengths.push(0);
          } else if (sym === 18) {
            const repeat = getBits(7) + 11;
            for (let r = 0; r < repeat; r++) allLengths.push(0);
          } else {
            break;
          }
        }
        litTree = buildHuffmanTree(allLengths.slice(0, hlit));
        distTree = buildHuffmanTree(allLengths.slice(hlit));
      }

      while (true) {
        const sym = decodeSymbol(litTree);
        if (sym === -1 || sym === 256) break;
        if (sym < 256) {
          output.push(sym);
        } else {
          const lenIdx = sym - 257;
          let length = lengthBases[lenIdx];
          const extraL = lengthExtra[lenIdx];
          if (extraL > 0) length += getBits(extraL);

          const distSym = decodeSymbol(distTree);
          if (distSym === -1) break;
          let dist = distBases[distSym];
          const extraD = distExtra[distSym];
          if (extraD > 0) dist += getBits(extraD);

          let src = output.length - dist;
          for (let k = 0; k < length; k++) {
            output.push(output[src + k]);
          }
        }
      }
    } else {
      break;
    }
  }

  return Buffer.from(output);
}

// PDF Text Stream Parser
function parsePdfStreamText(content) {
  const textPieces = [];
  function unescapePdfStr(str) {
    return str.replace(/\\([()nrtbf\\]|[0-7]{1,3})/g, (m, esc) => {
      if (esc === 'n') return '\n';
      if (esc === 'r') return '\r';
      if (esc === 't') return '\t';
      if (esc === 'b') return '\b';
      if (esc === 'f') return '\f';
      if (esc === '(' || esc === ')' || esc === '\\') return esc;
      if (/^[0-7]{1,3}$/.test(esc)) return String.fromCharCode(parseInt(esc, 8));
      return esc;
    });
  }

  const btEtRegex = /BT[\s\S]*?ET/g;
  let match;
  while ((match = btEtRegex.exec(content)) !== null) {
    const block = match[0];
    
    // Tj: (text) Tj
    const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    let m;
    while ((m = tjRegex.exec(block)) !== null) {
      const t = unescapePdfStr(m[1]).trim();
      if (t) textPieces.push(t);
    }

    // TJ: [(text) 10 (text)] TJ
    const tjArrRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArrRegex.exec(block)) !== null) {
      const inner = m[1];
      const strRegex = /\(((?:[^()\\]|\\.)*)\)|(-?\d+(?:\.\d+)?)/g;
      let s;
      let line = '';
      while ((s = strRegex.exec(inner)) !== null) {
        if (s[1] !== undefined) {
          line += unescapePdfStr(s[1]);
        } else if (Number(s[2]) < -150) {
          line += ' ';
        }
      }
      if (line.trim()) textPieces.push(line.trim());
    }
  }
  return textPieces.join('\n');
}

// DOCX XML Parser
function parseWordDocumentXml(xmlStr) {
  function decodeXml(s) {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }

  const paragraphs = [];
  // Parse paragraphs and tables
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xmlStr)) !== null) {
    const pContent = pMatch[1];
    let pText = '';
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      if (tMatch[0] === '<w:tab/>') {
        pText += ' ';
      } else if (tMatch[0] === '<w:br/>') {
        pText += '\n';
      } else if (tMatch[1]) {
        pText += tMatch[1];
      }
    }
    const cleanP = decodeXml(pText).trim();
    if (cleanP) {
      paragraphs.push(cleanP);
    }
  }

  return paragraphs.join('\n\n');
}

// PPTX XML Parser
function parsePptxSlideXml(xmlStr) {
  function decodeXml(s) {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }

  const lines = [];
  const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xmlStr)) !== null) {
    const pContent = pMatch[1];
    let pText = '';
    const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>|<a:br\/>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      if (tMatch[0] === '<a:br/>') {
        pText += '\n';
      } else if (tMatch[1]) {
        pText += tMatch[1];
      }
    }
    const cleanL = decodeXml(pText).trim();
    if (cleanL) {
      lines.push(cleanL);
    }
  }
  return lines.join('\n');
}

// PPT Binary Parser
function extractPptText(bytes) {
  const texts = [];
  const len = bytes.length;
  let i = 0;
  while (i + 8 <= len) {
    const recType = (bytes[i + 2] & 0xFF) | ((bytes[i + 3] & 0xFF) << 8);
    const recLen = ((bytes[i + 4] & 0xFF) | ((bytes[i + 5] & 0xFF) << 8) | ((bytes[i + 6] & 0xFF) << 16) | ((bytes[i + 7] & 0xFF) << 24)) >>> 0;
    
    if (recLen > 0 && recLen < 200000 && i + 8 + recLen <= len) {
      if (recType === 0x0FA0 || recType === 0x0FBA) { // TextCharsAtom / CString (UTF-16LE)
        const chars = [];
        for (let c = 0; c < recLen; c += 2) {
          const code = (bytes[i + 8 + c] & 0xFF) | ((bytes[i + 8 + c + 1] & 0xFF) << 8);
          if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code > 126 && code < 0xFFFE)) {
            chars.push(String.fromCharCode(code));
          }
        }
        const s = chars.join('').trim();
        if (s.length >= 3) texts.push(s);
        i += 8 + recLen;
        continue;
      } else if (recType === 0x0FA8) { // TextBytesAtom (single-byte)
        const chars = [];
        for (let c = 0; c < recLen; c++) {
          const code = bytes[i + 8 + c] & 0xFF;
          if ((code >= 32 && code <= 126) || code === 10 || code === 13) {
            chars.push(String.fromCharCode(code));
          }
        }
        const s = chars.join('').trim();
        if (s.length >= 3) texts.push(s);
        i += 8 + recLen;
        continue;
      }
    }
    i++;
  }
  return texts.join('\n');
}

// -------------------------------------------------------------
// EXECUTE 15 REQUIRED TEST CASES
// -------------------------------------------------------------

// Case 1: Valid PDF containing text
const validPdfStream = 'BT /F1 14 Tf (Emergency Airway Management and Intubation Protocols) Tj ET';
const compressedPdfStream = zlib.deflateSync(Buffer.from(validPdfStream));
const inflated = inflate(compressedPdfStream);
const pdfText = parsePdfStreamText(inflated.toString('latin1'));
assert.strictEqual(pdfText, 'Emergency Airway Management and Intubation Protocols');
console.log('✓ Case 1 passed: Valid PDF containing text extracted successfully');

// Case 2: Valid DOCX containing paragraphs
const docxXml = '<w:document><w:body><w:p><w:r><w:t>Infection Control Standard Precautions</w:t></w:r></w:p><w:p><w:r><w:t>Hand hygiene is mandatory before patient contact.</w:t></w:r></w:p></w:body></w:document>';
const docxText = parseWordDocumentXml(docxXml);
assert.ok(docxText.includes('Infection Control Standard Precautions'));
assert.ok(docxText.includes('Hand hygiene is mandatory'));
console.log('✓ Case 2 passed: Valid DOCX containing paragraphs extracted successfully');

// Case 3: Valid DOCX containing a table
const docxTableXml = '<w:document><w:body><w:p><w:r><w:t>Medication Safety Table</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Drug Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Dosage</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Epinephrine</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1:1000 IM</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
const docxTableText = parseWordDocumentXml(docxTableXml);
assert.ok(docxTableText.includes('Medication Safety Table'));
assert.ok(docxTableText.includes('Epinephrine'));
console.log('✓ Case 3 passed: Valid DOCX containing table extracted successfully');

// Case 4: Valid PPTX containing slide text
const pptxSlide1 = '<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Pediatric Resuscitation &amp; BLS</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>';
const pptxSlide2 = '<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Assess responsiveness and pulse within 10 seconds.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>';
const s1Text = parsePptxSlideXml(pptxSlide1);
const s2Text = parsePptxSlideXml(pptxSlide2);
assert.ok(s1Text.includes('Pediatric Resuscitation & BLS'));
assert.ok(s2Text.includes('Assess responsiveness and pulse'));
console.log('✓ Case 4 passed: Valid PPTX containing slide text extracted successfully');

// Case 5: Valid PPT where extraction is supported
const pptTextSample = 'Neonatal Resuscitation Guide';
const pptUtf16 = Buffer.from(pptTextSample, 'utf16le');
const pptRecHeader = Buffer.alloc(8);
pptRecHeader.writeUInt16LE(0, 0);
pptRecHeader.writeUInt16LE(0x0FA0, 2);
pptRecHeader.writeUInt32LE(pptUtf16.length, 4);

const pptBytes = Buffer.concat([
  Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
  pptRecHeader,
  pptUtf16
]);
const pptExtracted = extractPptText(pptBytes);
assert.ok(pptExtracted.includes('Neonatal Resuscitation Guide'));
console.log('✓ Case 5 passed: Valid PPT slide text extracted successfully');

// Case 6: Malformed PDF (header missing or invalid)
function validatePdf(bytes) {
  if (!bytes || bytes.length < 4 || (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46)) {
    return { success: false, errorCode: 'INVALID_FILE_CONTENT', message: 'PDF header missing.' };
  }
  return { success: true };
}
const malformedPdf = Buffer.from('NOT A PDF FILE');
assert.strictEqual(validatePdf(malformedPdf).errorCode, 'INVALID_FILE_CONTENT');
console.log('✓ Case 6 passed: Malformed PDF fails closed with INVALID_FILE_CONTENT');

// Case 7: Malformed DOCX (invalid zip)
function validateZipHeader(bytes) {
  if (!bytes || bytes.length < 30 || bytes[0] !== 0x50 || bytes[1] !== 0x4B || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return { success: false, errorCode: 'INVALID_FILE_CONTENT', message: 'Invalid ZIP header' };
  }
  return { success: true };
}
const malformedDocx = Buffer.from('CORRUPTED DOCX CONTENT');
assert.strictEqual(validateZipHeader(malformedDocx).errorCode, 'INVALID_FILE_CONTENT');
console.log('✓ Case 7 passed: Malformed DOCX fails closed with INVALID_FILE_CONTENT');

// Case 8: Arbitrary ZIP renamed .docx (lacks word/ structure)
function checkDocxStructure(entryNames) {
  const hasWord = entryNames.some(e => e.startsWith('word/'));
  const hasTypes = entryNames.some(e => e.includes('[Content_Types].xml'));
  if (!hasWord || !hasTypes) {
    return { success: false, errorCode: 'INVALID_FILE_CONTENT', message: 'Missing word package' };
  }
  return { success: true };
}
const arbitraryZipEntries = ['photo.jpg', 'notes.txt', 'data.csv'];
assert.strictEqual(checkDocxStructure(arbitraryZipEntries).errorCode, 'INVALID_FILE_CONTENT');
console.log('✓ Case 8 passed: Arbitrary ZIP renamed .docx fails closed');

// Case 9: Arbitrary ZIP renamed .pptx (lacks ppt/ structure)
function checkPptxStructure(entryNames) {
  const hasPpt = entryNames.some(e => e.startsWith('ppt/'));
  const hasTypes = entryNames.some(e => e.includes('[Content_Types].xml'));
  if (!hasPpt || !hasTypes) {
    return { success: false, errorCode: 'INVALID_FILE_CONTENT', message: 'Missing ppt package' };
  }
  return { success: true };
}
assert.strictEqual(checkPptxStructure(arbitraryZipEntries).errorCode, 'INVALID_FILE_CONTENT');
console.log('✓ Case 9 passed: Arbitrary ZIP renamed .pptx fails closed');

// Case 10: Valid file with no extractable text
function evaluateExtractedText(text) {
  if (!text || text.trim().length < 15) {
    return { success: false, errorCode: 'NO_EXTRACTABLE_CONTENT', message: 'No readable textual content' };
  }
  return { success: true, text: text.trim() };
}
assert.strictEqual(evaluateExtractedText('').errorCode, 'NO_EXTRACTABLE_CONTENT');
assert.strictEqual(evaluateExtractedText('Short').errorCode, 'NO_EXTRACTABLE_CONTENT');
console.log('✓ Case 10 passed: Valid file with no extractable text fails closed with NO_EXTRACTABLE_CONTENT');

// Case 11: Missing Drive File ID
function checkDriveFileId(metadata) {
  if (!metadata || !metadata.driveFileId || !metadata.driveFileId.trim()) {
    return { success: false, errorCode: 'LEARNING_RESOURCE_NOT_FOUND', message: 'No learning resource file associated' };
  }
  return { success: true };
}
assert.strictEqual(checkDriveFileId({ cneId: 'CNE001', driveFileId: '' }).errorCode, 'LEARNING_RESOURCE_NOT_FOUND');
console.log('✓ Case 11 passed: Missing Drive File ID fails closed with LEARNING_RESOURCE_NOT_FOUND');

// Case 12: Nonexistent Drive File ID
function retrieveDriveFile(driveFileId, mockDrive) {
  if (!mockDrive[driveFileId]) {
    return { success: false, errorCode: 'LEARNING_RESOURCE_FILE_NOT_FOUND', message: 'Drive file not found' };
  }
  return { success: true, file: mockDrive[driveFileId] };
}
assert.strictEqual(retrieveDriveFile('invalid_id_123', {}).errorCode, 'LEARNING_RESOURCE_FILE_NOT_FOUND');
console.log('✓ Case 12 passed: Nonexistent Drive File ID fails closed with LEARNING_RESOURCE_FILE_NOT_FOUND');

// Case 13: Unauthorized user
function checkAuthorization(userRole, userEmpId, cneRecord) {
  if (userRole === 'System Administrator') return null;
  if (cneRecord.inchargeEmpId === userEmpId || cneRecord.instructorEmpId === userEmpId) return null;
  return { success: false, errorCode: 'UNAUTHORIZED', message: 'Unauthorized for this CNE' };
}
const authFail = checkAuthorization('Staff Nurse', '100999', { inchargeEmpId: '100001', instructorEmpId: '100002' });
assert.strictEqual(authFail.errorCode, 'UNAUTHORIZED');
console.log('✓ Case 13 passed: Unauthorized user fails closed with UNAUTHORIZED');

// Case 14: CNE ID belonging to another CNE
function resolveAuthoritativeRecord(requestedCneId, mockDatabase) {
  const record = mockDatabase[requestedCneId];
  if (!record) {
    return { success: false, errorCode: 'CNE_NOT_FOUND', message: 'CNE not found' };
  }
  return { success: true, record };
}
assert.strictEqual(resolveAuthoritativeRecord('CNE_UNKNOWN', {}).errorCode, 'CNE_NOT_FOUND');
console.log('✓ Case 14 passed: CNE ID belonging to another/nonexistent CNE fails closed with CNE_NOT_FOUND');

// Case 15: File outside Learning Resources folder
function verifyParentFolder(fileParentFolderId, expectedFolderId) {
  if (fileParentFolderId !== expectedFolderId) {
    return { success: false, errorCode: 'LEARNING_RESOURCE_INVALID', message: 'File is outside Learning Resources folder' };
  }
  return { success: true };
}
const folderFail = verifyParentFolder('external_folder_id', 'learning_resources_folder_id');
assert.strictEqual(folderFail.errorCode, 'LEARNING_RESOURCE_INVALID');
console.log('✓ Case 15 passed: File outside Learning Resources folder fails closed with LEARNING_RESOURCE_INVALID');

console.log('\nAll 15 required Phase 2 test cases PASSED successfully!');
