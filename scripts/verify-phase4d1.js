/**
 * Phase 4D.1 Verification Test Suite
 * Validates the clinical relevance gate after calculateTopicRelevanceScore()
 * and ensures false positive clinical pairs are correctly filtered out.
 */

import assert from 'assert';
import fs from 'fs';

console.log('=== RUNNING PHASE 4D.1 SURGICAL RELEVANCE REFINEMENT TESTS ===\n');

// 1. Check Code.gs implementation
const codeGs = fs.readFileSync('Code.gs', 'utf8');

assert(codeGs.includes('function passesClinicalRelevanceGate('), 'passesClinicalRelevanceGate must be defined in Code.gs');
assert(codeGs.includes('CLINICAL_PROCEDURAL_TAXONOMY'), 'CLINICAL_PROCEDURAL_TAXONOMY must exist');
console.log('✓ passesClinicalRelevanceGate is defined in Code.gs');

// 2. Verify placement in retrieveCNETopicEvidence
const gateCallCount = (codeGs.match(/passesClinicalRelevanceGate\(cleanTopic,/g) || []).length;
assert(gateCallCount >= 2, 'passesClinicalRelevanceGate must be evaluated for both uploaded and library candidate chunks');
console.log(`✓ Relevance gate called in retrieval logic (${gateCallCount} locations)`);

// Check that calculateTopicRelevanceScore is called BEFORE passesClinicalRelevanceGate
const retrievalBlock = codeGs.substring(codeGs.indexOf('function retrieveCNETopicEvidence'), codeGs.indexOf('function handleRetrieveCNETopicEvidence'));
assert(retrievalBlock.includes('calculateTopicRelevanceScore(cleanTopic, uc)'), 'calculateTopicRelevanceScore must be evaluated first');
assert(retrievalBlock.includes('score > 0 && passesClinicalRelevanceGate(cleanTopic, uc)'), 'Gate must gate inclusion after scoring for uploaded candidates');
assert(retrievalBlock.includes('libScore > 0 && passesClinicalRelevanceGate(cleanTopic, lc)'), 'Gate must gate inclusion after scoring for library candidates');
console.log('✓ Gate is positioned strictly after scoring engine calculation and before inclusion');

// 3. Extract passesClinicalRelevanceGate implementation logic for unit testing
const taxonomyMatch = codeGs.match(/var CLINICAL_PROCEDURAL_TAXONOMY = (\[[\s\S]*?\n\]);/);
assert(taxonomyMatch, 'Could not extract CLINICAL_PROCEDURAL_TAXONOMY');
const CLINICAL_PROCEDURAL_TAXONOMY = eval(taxonomyMatch[1]);

// Extract gate function implementation
const gateStart = codeGs.indexOf('function passesClinicalRelevanceGate(');
const gateEnd = codeGs.indexOf('function retrieveCNETopicEvidence(');
assert(gateStart !== -1 && gateEnd !== -1, 'Could not locate gate function boundaries');
const gateCode = codeGs.substring(gateStart, gateEnd);

// Wrap in runnable function
const passesClinicalRelevanceGate = new Function('CLINICAL_PROCEDURAL_TAXONOMY', `
  ${gateCode}
  return passesClinicalRelevanceGate;
`)(CLINICAL_PROCEDURAL_TAXONOMY);

// --- TEST SUITE FOR PHASE 4D.1 ---

// Test 1: Generic clinical vocabulary alone must FAIL the gate
const genericChunk = {
  resourceTitle: 'General Clinical Nursing Procedures',
  topic: 'Clinical Skills',
  sectionHeading: 'General Patient Care Guidelines',
  clinicalKeywords: 'catheter, sterile, dressing, patient, care, nursing, procedure, infusion, monitoring, access, insertion',
  chunkText: 'The nurse should adhere to standard sterile technique when performing nursing care and procedures. Proper access and site selection ensures optimal patient management and infusion monitoring.'
};

console.log('\n--- Test 1: Generic Clinical Vocabulary Filtering ---');
const resGenericIv = passesClinicalRelevanceGate('IV Cannulation', genericChunk);
assert.strictEqual(resGenericIv, false, 'Generic clinical vocabulary alone must NOT qualify for IV Cannulation');
console.log('✓ Generic clinical vocabulary correctly rejected for IV Cannulation');

const resGenericFoley = passesClinicalRelevanceGate('Foley Catheterization', genericChunk);
assert.strictEqual(resGenericFoley, false, 'Generic clinical vocabulary alone must NOT qualify for Foley Catheterization');
console.log('✓ Generic clinical vocabulary correctly rejected for Foley Catheterization');

// Test 2: Foley Catheterization candidate chunk MUST NOT qualify for IV Cannulation
const foleyChunk = {
  resourceTitle: 'Nursing Skills 2e',
  topic: 'Urinary Catheterization',
  sectionHeading: 'Foley Catheter Insertion Technique and Balloon Inflation',
  clinicalKeywords: 'foley catheter, urinary retention, bladder, sterile field, retention balloon, drainage bag, sterile water',
  chunkText: 'Insert the Foley catheter into the urinary meatus until urine flashback is noted in the tubing. Inflate the retention balloon with 10 mL of sterile water and connect to the gravity drainage bag.'
};

console.log('\n--- Test 2: Cross-Procedural Contamination Prevention ---');
const crossIv = passesClinicalRelevanceGate('IV Cannulation', foleyChunk);
assert.strictEqual(crossIv, false, 'Foley Catheterization chunk must NOT qualify for IV Cannulation');
console.log('✓ Foley Catheterization chunk correctly rejected for IV Cannulation query');

// Test 3: IV Cannulation candidate chunk MUST qualify for IV Cannulation and NOT for Foley Catheterization
const ivChunk = {
  resourceTitle: 'Clinical Nursing Practice',
  topic: 'Vascular Access',
  sectionHeading: 'Peripheral IV Cannulation and Vein Selection',
  clinicalKeywords: 'iv cannulation, peripheral iv, venipuncture, tourniquet, vein, flashback, cannula gauge, catheter stabilization',
  chunkText: 'Apply the tourniquet 10-15 cm above the intended venipuncture site. Palpate the vein, clean with chlorhexidine, insert the IV cannula at a 15 to 30-degree angle until blood flashback appears in the chamber, then advance the catheter into the vein.'
};

const validIv = passesClinicalRelevanceGate('IV Cannulation', ivChunk);
assert.strictEqual(validIv, true, 'Genuine IV Cannulation chunk MUST qualify for IV Cannulation');
console.log('✓ Genuine IV Cannulation chunk passed for IV Cannulation query');

const crossFoley = passesClinicalRelevanceGate('Foley Catheterization', ivChunk);
assert.strictEqual(crossFoley, false, 'IV Cannulation chunk must NOT qualify for Foley Catheterization');
console.log('✓ IV Cannulation chunk correctly rejected for Foley Catheterization query');

// Test 4: Wound Dressing vs CPR
const cprChunk = {
  resourceTitle: 'Basic Life Support Guidelines',
  topic: 'Cardiopulmonary Resuscitation',
  sectionHeading: 'High-Quality Chest Compressions and AED Deployment',
  clinicalKeywords: 'cpr, cardiopulmonary resuscitation, chest compression, defibrillation, aed, cardiac arrest, rescue breaths',
  chunkText: 'Perform chest compressions at a rate of 100 to 120 per minute at a depth of at least 2 inches (5 cm). Minimize interruptions in compressions and apply the AED as soon as available.'
};

const cprValid = passesClinicalRelevanceGate('CPR', cprChunk);
assert.strictEqual(cprValid, true, 'Genuine CPR chunk MUST qualify for CPR');
console.log('✓ Genuine CPR chunk passed for CPR query');

const cprWound = passesClinicalRelevanceGate('Wound Dressing', cprChunk);
assert.strictEqual(cprWound, false, 'CPR chunk must NOT qualify for Wound Dressing');
console.log('✓ CPR chunk correctly rejected for Wound Dressing query');

// Test 5: Blood Transfusion vs Foley / Wound
const bloodChunk = {
  resourceTitle: 'Inpatient Transfusion Protocol',
  topic: 'Blood Product Administration',
  sectionHeading: 'Verification of Packed Red Blood Cells (PRBC) and Reaction Monitoring',
  clinicalKeywords: 'blood transfusion, prbc, crossmatch, abo rh compatibility, hemolytic reaction, blood tubing with filter',
  chunkText: 'Two nurses must independently verify the patient identification, ABO/Rh type, unit number, and expiration date at the bedside before initiating the blood transfusion. Monitor vital signs every 15 minutes.'
};

const bloodValid = passesClinicalRelevanceGate('Blood Transfusion', bloodChunk);
assert.strictEqual(bloodValid, true, 'Genuine Blood Transfusion chunk MUST qualify for Blood Transfusion');
console.log('✓ Blood Transfusion chunk passed for Blood Transfusion query');

const bloodFoley = passesClinicalRelevanceGate('Foley Catheterization', bloodChunk);
assert.strictEqual(bloodFoley, false, 'Blood Transfusion chunk must NOT qualify for Foley Catheterization');
console.log('✓ Blood Transfusion chunk correctly rejected for Foley Catheterization query');

// Test 6: Nonexistent topic (Quantum Physics) must fail all clinical chunks
console.log('\n--- Test 3: Nonexistent Query Gate Test ---');
const nonexistentQuery = 'Quantum Particle Entanglement In Intergalactic Space';
assert.strictEqual(passesClinicalRelevanceGate(nonexistentQuery, ivChunk), false);
assert.strictEqual(passesClinicalRelevanceGate(nonexistentQuery, foleyChunk), false);
assert.strictEqual(passesClinicalRelevanceGate(nonexistentQuery, cprChunk), false);
assert.strictEqual(passesClinicalRelevanceGate(nonexistentQuery, bloodChunk), false);
console.log('✓ Nonexistent topic "Quantum Particle Entanglement" correctly rejected across all clinical chunks');

console.log('\n======================================================');
console.log('ALL PHASE 4D.1 RELEVANCE GATE TESTS PASSED PERFECTLY!');
console.log('======================================================\n');
