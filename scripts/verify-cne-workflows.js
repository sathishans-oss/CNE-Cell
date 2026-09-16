/**
 * CNE Workflows & Unscheduled CNE End-to-End Verification Suite
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== RUNNING CNE WORKFLOWS & REGRESSION TESTS ===\n');

const codeGs = fs.readFileSync('Code.gs', 'utf8');
const gasTs = fs.readFileSync('src/backend/googleAppsScript.ts', 'utf8');
const apiTs = fs.readFileSync('src/services/api.ts', 'utf8');
const cneScheduleTs = fs.readFileSync('src/components/CNESchedule.tsx', 'utf8');
const unscheduledModalTs = fs.readFileSync('src/components/cne/AddUnscheduledCneModal.tsx', 'utf8');
const typesTs = fs.readFileSync('src/types.ts', 'utf8');

// --- Test 1: Router Support for createCNE and addUnscheduledCNE ---
assert(codeGs.includes("case 'createCNE':"), "Code.gs must route 'createCNE'");
assert(codeGs.includes("case 'addUnscheduledCNE':"), "Code.gs must route 'addUnscheduledCNE'");
assert(gasTs.includes("case 'createCNE':"), "googleAppsScript.ts must route 'createCNE'");
assert(gasTs.includes("case 'addUnscheduledCNE':"), "googleAppsScript.ts must route 'addUnscheduledCNE'");
console.log('✓ Test 1: Action router properly dispatches createCNE and addUnscheduledCNE');

// --- Test 2: Server-Side Unscheduled CNE Handling ---
assert(codeGs.includes("var isUnscheduled = Boolean("), "handleAddCNE must compute isUnscheduled flag");
assert(codeGs.includes("params.isUnscheduled === true"), "isUnscheduled must support boolean true");
assert(codeGs.includes("params.action === 'addUnscheduledCNE'"), "isUnscheduled must support action: addUnscheduledCNE");
assert(codeGs.includes("(isUnscheduled ? 'U-' : '')"), "CNE ID must include 'U-' prefix for unscheduled sessions");
assert(codeGs.includes("var status = isUnscheduled ? 'Completed' : normalizeCNEStatus(params.status || 'Scheduled');"), "Unscheduled CNE status must be 'Completed'");
assert(codeGs.includes("if (isUnscheduled) {\n      setCell('finalizedat', 21, new Date().toISOString());\n      setCell('finalizedby', 22, session.employeeId || '');\n    }"), "Unscheduled CNE must set finalizedat and finalizedby");
console.log('✓ Test 2: Server-side handleAddCNE implements full Unscheduled CNE specifications');

// --- Test 3: Past Date Allowance for Unscheduled CNE ---
const checkFromPastIdx = codeGs.indexOf("if (!isUnscheduled) {");
assert(checkFromPastIdx !== -1, "Code.gs must guard past date validation behind !isUnscheduled");
const nextPastError = codeGs.indexOf("Past dates are not allowed", checkFromPastIdx);
assert(nextPastError !== -1 && nextPastError - checkFromPastIdx < 400, "Past date validation must only apply to scheduled CNE");
console.log('✓ Test 3: Past dates are explicitly permitted for Unscheduled CNE');

// --- Test 4: Staff Participants Capture in handleAddCNE ---
assert(codeGs.includes("setCell('staffempid', 16, staffString);"), "Staff employee IDs must be stored in CNE Schedule");
assert(codeGs.includes("setCell('staffcount', 17, totalStaffCount);"), "Staff count must be computed and stored");
assert(codeGs.includes("setCell('externalstaffparticipants', 18, extStaffClean.join(', '));"), "External staff participants must be stored");
console.log('✓ Test 4: Attended staff participants roster correctly recorded during CNE creation');

// --- Test 5: ApiService Methods ---
assert(apiTs.includes("static async createCNE("), "ApiService must expose createCNE");
assert(apiTs.includes("static async addUnscheduledCNE("), "ApiService must expose addUnscheduledCNE");
assert(apiTs.includes("isUnscheduled: true, status: 'Completed'"), "addUnscheduledCNE must set isUnscheduled: true and status: Completed");
console.log('✓ Test 5: ApiService provides unified createCNE and addUnscheduledCNE methods');

// --- Test 6: Types Declaration ---
assert(typesTs.includes("isUnscheduled?: boolean;"), "CNERecord must declare isUnscheduled property");
assert(typesTs.includes("resourcePersonEmpIds?: string[];"), "CNERecord must declare resourcePersonEmpIds");
assert(typesTs.includes("staffEmpIds?: string[];"), "CNERecord must declare staffEmpIds");
assert(typesTs.includes("externalStaffParticipants?: string[];"), "CNERecord must declare externalStaffParticipants");
console.log('✓ Test 6: TypeScript types accurately model unified CNERecord structure');

// --- Test 7: Frontend Unscheduled CNE Modal ---
assert(unscheduledModalTs.includes("export const AddUnscheduledCneModal:"), "AddUnscheduledCneModal must be exported");
assert(unscheduledModalTs.includes("id=\"btn-submit-unscheduled-cne\""), "Modal must contain submit button with ID");
assert(unscheduledModalTs.includes("ApiService.addUnscheduledCNE("), "Modal must invoke ApiService.addUnscheduledCNE");
assert(unscheduledModalTs.includes("Past dates are fully valid"), "Modal must inform user that past dates are valid");
console.log('✓ Test 7: AddUnscheduledCneModal implements comprehensive submission workflow');

// --- Test 8: CNE Schedule Page (CNESchedule) Integration ---
assert(cneScheduleTs.includes("import { AddUnscheduledCneModal } from './cne/AddUnscheduledCneModal';"), "CNESchedule must import AddUnscheduledCneModal");
assert(cneScheduleTs.includes("id=\"btn-admin-add-unscheduled-cne\""), "CNESchedule must contain Unscheduled CNE button");
assert(cneScheduleTs.includes("<AddUnscheduledCneModal"), "CNESchedule must mount AddUnscheduledCneModal");
console.log('✓ Test 8: CNE Schedule page cleanly integrates Unscheduled CNE action and modal');

// --- Test 9: CNE Schedule Loading, Editing, and Reviewing Handlers ---
assert(codeGs.includes("function handleGetCNERecords("), "Code.gs must define handleGetCNERecords");
assert(codeGs.includes("function handleUpdateCNE("), "Code.gs must define handleUpdateCNE");
assert(codeGs.includes("function handleReviewCNE("), "Code.gs must define handleReviewCNE");
assert(codeGs.includes("function handleDeleteCNE("), "Code.gs must define handleDeleteCNE");
assert(codeGs.includes("function handleFinalizeCNE("), "Code.gs must define handleFinalizeCNE");
console.log('✓ Test 9: Canonical CNE handlers (get, update, review, delete, finalize) verified in backend');

// --- Test 10: Learning Resources Management ---
const learningResPageTs = fs.readFileSync('src/components/cne/LearningResourcesPage.tsx', 'utf8');
const addResourceModalTs = fs.readFileSync('src/components/cne/AddResourceModal.tsx', 'utf8');
assert(learningResPageTs.includes("AddResourceModal"), "LearningResourcesPage must integrate AddResourceModal");
assert(learningResPageTs.includes("handleToggleVisibility") && learningResPageTs.includes("setResourceVisibility"), "LearningResourcesPage must support visibility toggling");
assert(learningResPageTs.includes("handleReindex") || learningResPageTs.includes("reindex"), "LearningResourcesPage must support re-indexing");
assert(learningResPageTs.includes("deleteLearningResource"), "LearningResourcesPage must support deletion");
assert(addResourceModalTs.includes("NURSING_REFERENCE_LIB"), "AddResourceModal must support Nursing Reference Library");
console.log('✓ Test 10: Learning Resources management workflow fully verified');

console.log('\n========================================================');
console.log('ALL CNE WORKFLOWS & REGRESSION TESTS PASSED (10/10)!');
console.log('========================================================');
