/**
 * ============================================================================
 * AUTHORITATIVE PRODUCTION AI ENDPOINT (Cloudflare Pages Function)
 * ============================================================================
 * Platform: Cloudflare Pages
 * Route: POST /api/ai/generate-questions
 * Implementation: functions/api/ai/generate-questions.ts
 *
 * This Cloudflare Function is the authoritative production endpoint handling
 * CNE AI question generation (both MATERIAL and EXTERNAL modes).
 * ============================================================================
 */

interface CloudflareEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  APPS_SCRIPT_URL?: string;
  VITE_APPS_SCRIPT_URL?: string;
  [key: string]: any;
}

interface RawGeneratedQuestion {
  questionText?: string;
  question?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  options?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  correctOption?: string;
  correctAnswer?: string;
  explanation?: string;
  rationale?: string;
  authoritativeSource?: string;
  source?: string;
  reference?: string;
  sourceUrl?: string;
  sourceRetrievedAt?: string;
  sourceId?: string;
}

// Interface for retrieved external clinical sources (Europe PMC & NCBI / PubMed Central)
interface RetrievedClinicalSource {
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  journal?: string;
  evidenceText: string;
  retrievedAt: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
};

function createJsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

// Authoritative external clinical source retrieval via free, open-access biomedical repositories (Europe PMC & NCBI)
async function retrieveExternalClinicalSources(topic: string): Promise<RetrievedClinicalSource[] | null> {
  const cleanTopic = topic.replace(/[^\w\s-]/g, ' ').trim();
  if (cleanTopic.length < 3) return null;

  const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const sources: RetrievedClinicalSource[] = [];

  // Primary: Europe PMC REST API (EBI / PubMed Central Open Access / NIH / WHO literature)
  try {
    const query = `${cleanTopic} (nursing OR clinical OR guideline OR hospital OR "patient care" OR protocol)`;
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=4&resultType=core`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'CNE-Clinical-Platform/1.0' }
    });
    if (res.ok) {
      const data: any = await res.json();
      const list = data?.resultList?.result || [];
      for (const item of list) {
        const title = (item.title || '').replace(/<[^>]+>/g, '').trim();
        const abstract = (item.abstractText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const journal = item.journalInfo?.journal?.title || item.bookOrReportDetails?.publisher || 'Peer-Reviewed Clinical Literature';
        const doi = item.doi;
        const pmid = item.pmid;
        const pmcId = item.id;
        const docUrl = doi ? `https://doi.org/${doi}` : (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : `https://europepmc.org/article/MED/${item.id}`);
        const sourceId = pmid ? `PMID_${pmid}` : (pmcId ? `PMC_${pmcId}` : (doi ? `DOI_${doi.replace(/[^a-zA-Z0-9]/g, '_')}` : `SRC_${sources.length + 1}`));

        // STRICT EVIDENCE REQUIREMENT: Must have real abstract clinical text (at least 60 characters)
        if (title && abstract.length >= 60) {
          sources.push({
            sourceId,
            sourceName: journal,
            title,
            url: docUrl,
            journal,
            evidenceText: abstract,
            retrievedAt: nowUtc
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[AI Service] Europe PMC retrieval warning:', err?.message || err);
  }

  // Secondary fallback: NCBI PubMed E-Utilities (efetch with real abstract XML)
  if (sources.length === 0) {
    try {
      const ncbiSearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(cleanTopic + ' (nursing OR clinical OR guideline OR protocol)')}&retmode=json&retmax=4`;
      const searchRes = await fetch(ncbiSearchUrl, { signal: AbortSignal.timeout(8000) });
      if (searchRes.ok) {
        const searchData: any = await searchRes.json();
        const idList: string[] = searchData?.esearchresult?.idlist || [];
        if (idList.length > 0) {
          const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${idList.join(',')}&retmode=xml`;
          const fetchRes = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
          if (fetchRes.ok) {
            const xml = await fetchRes.text();
            const articleBlocks = xml.split(/<\/PubmedArticle>/i);
            for (const block of articleBlocks) {
              const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/i);
              const titleMatch = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/i);
              const journalMatch = block.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/i) || block.match(/<MedlineTA>([\s\S]*?)<\/MedlineTA>/i);
              const doiMatch = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/i);

              const abstractMatches = [...block.matchAll(/<AbstractText(?:\s+[^>]*)?>([\s\S]*?)<\/AbstractText>/gi)];
              const abstract = abstractMatches
                .map(m => m[1].replace(/<[^>]+>/g, ' ').trim())
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

              // STRICT EVIDENCE REQUIREMENT: Real abstract only. No title-only evidence, no placeholder text.
              if (pmidMatch && titleMatch && abstract.length >= 60) {
                const pmid = pmidMatch[1];
                const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
                const journal = (journalMatch ? journalMatch[1].replace(/<[^>]+>/g, '') : 'NCBI PubMed').trim();
                const doi = doiMatch ? doiMatch[1].trim() : null;
                const docUrl = doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

                sources.push({
                  sourceId: `PMID_${pmid}`,
                  sourceName: journal,
                  title,
                  url: docUrl,
                  journal,
                  evidenceText: abstract,
                  retrievedAt: nowUtc
                });
              }
            }
          }
        }
      }
    } catch (ncbiErr: any) {
      console.warn('[AI Service] NCBI retrieval warning:', ncbiErr?.message || ncbiErr);
    }
  }

  // Total evidence check: Must have at least 1 real source with meaningful content
  if (sources.length === 0) {
    return null;
  }

  const totalContentLength = sources.reduce((acc, s) => acc + s.evidenceText.length, 0);
  if (totalContentLength < 60) {
    return null;
  }

  return sources;
}

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: JSON_HEADERS
  });
};

export const onRequestPost = async (context: {
  request: Request;
  env: CloudflareEnv;
}): Promise<Response> => {
  const { request, env } = context;

  // 1. Parse JSON payload safely
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return createJsonResponse({
      success: false,
      errorCode: 'INVALID_REQUEST',
      message: 'Invalid JSON payload in request body.'
    }, 400);
  }

  const {
    cneId,
    topic,
    cneMaterial,
    referenceMaterial,
    syllabus,
    reservationToken,
    token,
    loggedInEmployeeId,
    generationSource,
    sourceMode
  } = body || {};

  const cleanCneId = String(cneId || '').trim();
  const cleanToken = String(reservationToken || '').trim();
  const cleanSessionToken = String(token || '').trim();
  const cleanEmpId = String(loggedInEmployeeId || '').trim();
  const cleanTopic = String(topic || '').trim();
  const cleanMaterial = String(cneMaterial || referenceMaterial || syllabus || '').trim();
  const rawSource = String(generationSource || sourceMode || 'MATERIAL').trim().toUpperCase();
  const isExternalSource = rawSource === 'EXTERNAL';

  // 2. Validate required basic parameters before network calls
  if (!cleanSessionToken) {
    return createJsonResponse({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Authentication session token is required to generate AI questions. Please sign in.'
    }, 401);
  }

  if (!cleanCneId) {
    return createJsonResponse({
      success: false,
      errorCode: 'CNE_ID_REQUIRED',
      message: 'CNE ID is required.'
    }, 400);
  }

  if (!cleanToken) {
    return createJsonResponse({
      success: false,
      errorCode: 'RESERVATION_TOKEN_REQUIRED',
      message: 'A valid AI quota reservation token is required before invoking question generation.'
    }, 403);
  }

  // 3. Authoritative backend URL check (strictly from server environment binding)
  const rawAppsScriptUrl = (
    env?.VITE_APPS_SCRIPT_URL ||
    env?.APPS_SCRIPT_URL ||
    (typeof process !== 'undefined' && (process.env?.VITE_APPS_SCRIPT_URL || process.env?.APPS_SCRIPT_URL)) ||
    ''
  ).trim();

  let appsScriptUrl = '';
  if (rawAppsScriptUrl) {
    try {
      const parsed = new URL(rawAppsScriptUrl);
      const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (parsed.protocol === 'https:' || (isLocal && parsed.protocol === 'http:')) {
        appsScriptUrl = rawAppsScriptUrl;
      } else {
        console.warn('[AI Service] Non-HTTPS Apps Script URL rejected in production:', rawAppsScriptUrl);
      }
    } catch {
      appsScriptUrl = '';
    }
  }

  if (!appsScriptUrl) {
    return createJsonResponse({
      success: false,
      errorCode: 'BACKEND_NOT_CONFIGURED',
      message: 'Authoritative Apps Script backend service URL is not configured on the server.'
    }, 503);
  }

  // 4. Authoritatively validate session, CNE authorization, and quota reservation against Apps Script
  let authResult: any;
  try {
    const authRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'validateAiQuotaReservation',
        cneId: cleanCneId,
        reservationToken: cleanToken,
        token: cleanSessionToken,
        loggedInEmployeeId: cleanEmpId,
        generationSource: isExternalSource ? 'EXTERNAL' : 'MATERIAL'
      })
    });

    if (!authRes.ok) {
      return createJsonResponse({
        success: false,
        errorCode: 'AUTH_SERVICE_ERROR',
        message: 'Failed to communicate with authoritative authentication service.'
      }, 502);
    }

    authResult = await authRes.json();
  } catch (fetchErr: any) {
    return createJsonResponse({
      success: false,
      errorCode: 'AUTH_SERVICE_UNAVAILABLE',
      message: 'Authoritative authentication service is unreachable. Question generation aborted.'
    }, 502);
  }

  // 5. Evaluate authoritative Apps Script authorization verdict
  if (!authResult || !authResult.success) {
    const errCode = authResult?.errorCode || 'UNAUTHORIZED';
    const statusCode = (errCode === 'UNAUTHORIZED') ? 401 : 403;
    return createJsonResponse({
      success: false,
      errorCode: errCode,
      message: authResult?.message || 'Authoritative authorization or quota reservation validation failed.'
    }, statusCode);
  }

  // 6. Anti-parameter substitution: ensure reservation belongs strictly to requested CNE record
  const verifiedCneId = String(authResult.data?.cneId || '').trim();
  const verifiedToken = String(authResult.data?.reservationToken || '').trim();
  if (
    !verifiedCneId ||
    verifiedCneId.toUpperCase() !== cleanCneId.toUpperCase() ||
    verifiedToken !== cleanToken
  ) {
    return createJsonResponse({
      success: false,
      errorCode: 'PARAMETER_SUBSTITUTION_DETECTED',
      message: 'Reservation token does not match the requested CNE record.'
    }, 403);
  }

  const authoritativeTopic = String(authResult.data?.topic || cleanTopic).trim();
  if (!authoritativeTopic) {
    return createJsonResponse({
      success: false,
      errorCode: 'TOPIC_REQUIRED',
      message: 'CNE Topic is required for generating questions.'
    }, 400);
  }

  const authoritativeResourcePerson = String(authResult.data?.resourcePersonName || '').trim();

  // Authoritative learning content resolution:
  const hasLearningResource = Boolean(authResult.data?.hasLearningResource);
  const authoritativeMaterial = hasLearningResource
    ? String(authResult.data?.authoritativeLearningContent || '').trim()
    : String(authResult.data?.authoritativeLearningContent || cleanMaterial || '').trim();

  if (!isExternalSource && (!authoritativeMaterial || authoritativeMaterial.length < 15)) {
    return createJsonResponse({
      success: false,
      errorCode: 'MATERIAL_REQUIRED',
      message: 'CNE Class Content / Learning Material is required (minimum 15 characters) before AI questions can be generated.'
    }, 400);
  }

  // Helper to release quota reservation server-side to prevent stranded reservations on failure
  const releaseServerSideReservation = async (reason: string) => {
    try {
      console.log(`[AI Service] Releasing reservation for CNE ${cleanCneId} due to: ${reason}`);
      const relRes = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'releaseAiQuota',
          cneId: cleanCneId,
          reservationToken: cleanToken,
          token: cleanSessionToken,
          loggedInEmployeeId: cleanEmpId
        })
      });
      const relData: any = await relRes.json().catch(() => null);
      return relData?.success === true;
    } catch (relErr: any) {
      console.error('[AI Service] Failed to release quota reservation:', relErr?.message || relErr);
      return false;
    }
  };

  // In External Sources mode: Retrieve authoritative clinical literature before invoking Gemini
  let externalSources: RetrievedClinicalSource[] | null = null;
  if (isExternalSource) {
    try {
      externalSources = await retrieveExternalClinicalSources(authoritativeTopic);
    } catch (fetchErr: any) {
      console.error('[AI Service] External source retrieval error:', fetchErr?.message || fetchErr);
    }

    if (!externalSources || externalSources.length === 0) {
      await releaseServerSideReservation(`No suitable external clinical sources found for topic "${authoritativeTopic}"`);
      return createJsonResponse({
        success: false,
        errorCode: 'EXTERNAL_SOURCES_UNAVAILABLE',
        message: `Suitable external clinical sources could not be retrieved for topic "${authoritativeTopic}". Please retry or use "Generate from Given Material" instead.`,
        reservationReleased: true
      }, 200);
    }
  }

  // 7. Check Gemini API key from Cloudflare secret binding
  const apiKey = (
    env?.GEMINI_API_KEY ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    ''
  ).trim();

  if (!apiKey) {
    if (isExternalSource) {
      await releaseServerSideReservation('Gemini API is not configured on the server');
    }
    return createJsonResponse({
      success: false,
      errorCode: 'AI_CONFIGURATION_ERROR',
      message: 'Gemini API is not configured on the server.',
      reservationReleased: isExternalSource
    }, 503);
  }

  try {
    const BLOCKED_PAID_MODELS = new Set([
      'gemini-3.1-pro-preview',
      'gemini-3.1-pro',
      'gemini-3-pro-image',
      'gemini-3.1-flash-image',
      'gemini-3.1-flash-lite-image',
      'gemini-pro',
      'veo-3.1-generate-preview',
      'veo-3.1-lite-generate-preview',
      'lyria-3-clip-preview',
      'lyria-3-pro-preview'
    ]);

    const configuredModel = (
      env?.GEMINI_MODEL ||
      (typeof process !== 'undefined' && process.env?.GEMINI_MODEL) ||
      ''
    ).trim();

    if (!configuredModel) {
      if (isExternalSource) {
        await releaseServerSideReservation('GEMINI_MODEL is not configured on the server');
      }
      return createJsonResponse({
        success: false,
        errorCode: 'GEMINI_MODEL_NOT_CONFIGURED',
        message: 'GEMINI_MODEL environment variable is not configured on the server.',
        reservationReleased: isExternalSource
      }, 503);
    }

    if (BLOCKED_PAID_MODELS.has(configuredModel) || /pro|image|veo|lyria/i.test(configuredModel)) {
      if (isExternalSource) {
        await releaseServerSideReservation(`Paid model "${configuredModel}" prohibited`);
      }
      return createJsonResponse({
        success: false,
        errorCode: 'PAID_MODEL_PROHIBITED',
        message: `Configured model "${configuredModel}" is a paid model. Paid models are prohibited.`,
        reservationReleased: isExternalSource
      }, 403);
    }

    let prompt = '';
    if (isExternalSource && externalSources) {
      const sourcesText = externalSources.map((s, idx) => `
[Source ID: ${s.sourceId}]
Source Name / Journal: ${s.journal || s.sourceName}
Article Title: ${s.title}
Permanent URL: ${s.url}
Retrieved At: ${s.retrievedAt}
Clinical Findings, Evidence & Protocols:
${s.evidenceText}
`).join('\n---\n');

      prompt = `You are a Senior Clinical Nursing Education Specialist and Examiner at AIIMS (All India Institute of Medical Sciences).
Your task is to generate EXACTLY 5 high-quality Multiple Choice Questions (MCQs) for a Clinical Nursing Education (CNE) session post-test evaluation.

CNE Topic:
"${authoritativeTopic}"

AUTHORITATIVE EXTERNAL CLINICAL SOURCES RETRIEVED (PRIMARY GROUNDING SOURCE):
"""
${sourcesText}
"""

GROUNDING AND SOURCE ATTRIBUTION REQUIREMENTS (STRICT):
1. PRIMARY GROUNDING SOURCE: All 5 questions, correct answers, and distractors must be strictly grounded in and directly verifiable from the retrieved authoritative clinical sources provided above.
2. SOURCE ATTRIBUTION:
   - For each question, the "sourceId" field MUST be the exact Source ID from the retrieved sources above (e.g. "${externalSources[0].sourceId}").
   - For each question, the "authoritativeSource" field MUST cite the specific retrieved external source name, its direct URL, and the retrieval timestamp.
   - Example format: "${externalSources[0].journal || externalSources[0].sourceName} (${externalSources[0].url}) [Retrieved: ${externalSources[0].retrievedAt}]"
   - DO NOT fabricate unretrieved sources or invent fake URLs or IDs.
   - Absolutely DO NOT cite random blogs, forums, social media, commercial SEO articles, or unverified websites.
3. CLINICAL RIGOR: Focus on evidence-based nursing care, patient assessment, safety protocols, medication precautions, and clinical management.
4. OPTIONS: Each question must have EXACTLY 4 distinct, plausible options labeled A, B, C, and D.
5. CORRECT ANSWER: Exactly one option must be the correct answer ("A", "B", "C", or "D").
6. CLINICAL RATIONALE: Provide an evidence-based clinical rationale explaining why the correct option is the standard of care based on the cited external source.
7. AUTHORITATIVE SOURCE: Every single question MUST provide the "authoritativeSource" field reflecting genuine grounding from the retrieved external sources.
8. Output MUST strictly conform to the requested JSON schema with an array of exactly 5 question objects.`;
    } else {
      prompt = `You are a Senior Clinical Nursing Education Specialist and Examiner at AIIMS (All India Institute of Medical Sciences).
Your task is to generate EXACTLY 5 high-quality Multiple Choice Questions (MCQs) for a Clinical Nursing Education (CNE) session post-test evaluation.

CNE Topic:
"${authoritativeTopic}"
${authoritativeResourcePerson ? `Resource Person / Speaker:\n"${authoritativeResourcePerson}"\n` : ''}
Authoritative CNE Session Content / Learning Material (PRIMARY GROUNDING SOURCE):
"""
${authoritativeMaterial}
"""

GROUNDING AND SOURCE VERIFICATION REQUIREMENTS (STRICT):
1. PRIMARY GROUNDING SOURCE: Use the uploaded CNE session content and learning material above as your PRIMARY grounding source. All 5 questions, correct answers, and distractors must be strictly grounded in and directly verifiable from this supplied CNE session material.
2. EVIDENCE & SOURCE ATTRIBUTION:
   - For each question, extract and cite the specific authoritative clinical guideline, protocol, or standard cited in or directly supporting the session (e.g., "AIIMS Clinical Nursing Protocols", "WHO Guidelines", "Ministry of Health and Family Welfare / INC Standards", "Indian Nursing Council Standards", "CDC Clinical Guidelines", or peer-reviewed medical literature).
   - If genuine external live web search retrieval is not performed, DO NOT fabricate online verification, DO NOT invent fake URLs, and DO NOT falsely claim that a live web search occurred. Instead, cite authoritative references contained in the supplied material or clearly designate the source as derived from the verified CNE session (e.g., "Verified CNE Session: [Topic/Section/Protocol]").
   - Absolutely DO NOT cite random blogs, forums, social media, commercial SEO articles, or unverified websites.
3. CLINICAL RIGOR: Focus on clinical nursing practice, patient assessment, pharmacological safety, emergency escalation, infection control protocols, and nursing care standards.
4. OPTIONS: Each question must have EXACTLY 4 distinct, plausible options labeled A, B, C, and D.
5. CORRECT ANSWER: Exactly one option must be the correct answer ("A", "B", "C", or "D").
6. CLINICAL RATIONALE: Provide an evidence-based clinical rationale/explanation for why the correct option is the standard of care.
7. AUTHORITATIVE SOURCE: Every single question MUST provide the "authoritativeSource" field reflecting genuine grounding as specified above.
8. Output MUST strictly conform to the requested JSON schema with an array of exactly 5 question objects.`;
    }

    let generatedText = '';
    let usedModel = configuredModel;
    let lastError: any = null;
    let isTransientCapacityIssue = false;

    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${configuredModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const geminiRes = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'aistudio-build'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'object',
                properties: {
                  questions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        questionText: { type: 'string' },
                        optionA: { type: 'string' },
                        optionB: { type: 'string' },
                        optionC: { type: 'string' },
                        optionD: { type: 'string' },
                        correctOption: { type: 'string' },
                        explanation: { type: 'string' },
                        authoritativeSource: { type: 'string' },
                        sourceId: { type: 'string' }
                      },
                      required: isExternalSource
                        ? ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption', 'explanation', 'authoritativeSource', 'sourceId']
                        : ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption', 'explanation', 'authoritativeSource']
                    }
                  }
                },
                required: ['questions']
              }
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData: any = await geminiRes.json();
          const textCandidate = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textCandidate) {
            generatedText = textCandidate;
            lastError = null;
            isTransientCapacityIssue = false;
            break;
          }
        } else {
          const errData: any = await geminiRes.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${geminiRes.status}`;
          lastError = new Error(errMsg);
          if (geminiRes.status === 503 || geminiRes.status === 429 || /503|429|high demand|UNAVAILABLE|RESOURCE_EXHAUSTED|capacity/i.test(errMsg)) {
            isTransientCapacityIssue = true;
          }
          if (attempt < MAX_RETRIES && isTransientCapacityIssue) {
            await new Promise(r => setTimeout(r, 1000));
          } else {
            break;
          }
        }
      } catch (attemptErr: any) {
        lastError = attemptErr;
        const msg = attemptErr?.message || String(attemptErr);
        if (/503|429|high demand|UNAVAILABLE|RESOURCE_EXHAUSTED|capacity/i.test(msg)) {
          isTransientCapacityIssue = true;
        }
        if (attempt < MAX_RETRIES && isTransientCapacityIssue) {
          await new Promise(r => setTimeout(r, 1000));
        } else {
          break;
        }
      }
    }

    let rawQuestionsList: RawGeneratedQuestion[] = [];

    if (generatedText) {
      let cleaned = generatedText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      try {
        const parsed = JSON.parse(cleaned);
        rawQuestionsList = Array.isArray(parsed)
          ? parsed
          : (Array.isArray(parsed?.questions) ? parsed.questions : []);
      } catch {
        rawQuestionsList = [];
      }
    }

    if (!rawQuestionsList || rawQuestionsList.length !== 5) {
      throw new Error(
        isExternalSource
          ? `Unable to generate questions from external sources for topic "${authoritativeTopic}". Please retry or use "Generate from Given Material".`
          : `Gemini model was unable to generate valid clinical questions for topic "${authoritativeTopic}". Please ensure the configured model is available and retry.`
      );
    }

    if (rawQuestionsList.length !== 5) {
      throw new Error(`AI returned ${rawQuestionsList.length} questions instead of exactly 5.`);
    }

    const seenQuestionTexts = new Set<string>();
    const validatedQuestions = [];

    for (let idx = 0; idx < rawQuestionsList.length; idx++) {
      const item = rawQuestionsList[idx];
      const qText = String(item.questionText || item.question || '').trim();
      const optA = String(item.optionA || item.options?.A || '').trim();
      const optB = String(item.optionB || item.options?.B || '').trim();
      const optC = String(item.optionC || item.options?.C || '').trim();
      const optD = String(item.optionD || item.options?.D || '').trim();
      const rawCorrect = String(item.correctOption || item.correctAnswer || '').trim().toUpperCase();
      const explanation = String(item.explanation || item.rationale || '').trim();
      let authSource = String(item.authoritativeSource || item.source || item.reference || '').trim();

      if (qText.length < 8) {
        throw new Error(`Question ${idx + 1} has insufficient or empty question text.`);
      }

      const normalizedQ = qText.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenQuestionTexts.has(normalizedQ)) {
        throw new Error(`Duplicate question detected at question ${idx + 1}.`);
      }
      seenQuestionTexts.add(normalizedQ);

      if (!optA || !optB || !optC || !optD) {
        throw new Error(`Question ${idx + 1} is missing one or more options.`);
      }

      const optSet = new Set([optA.toLowerCase(), optB.toLowerCase(), optC.toLowerCase(), optD.toLowerCase()]);
      if (optSet.size < 4) {
        throw new Error(`Question ${idx + 1} contains duplicate options.`);
      }

      if (!['A', 'B', 'C', 'D'].includes(rawCorrect)) {
        throw new Error(`Question ${idx + 1} has invalid correctOption "${rawCorrect}".`);
      }

      if (explanation.length < 5) {
        throw new Error(`Question ${idx + 1} is missing a clinical explanation/rationale.`);
      }

      // Match external source if in external mode - STRICT EXACT SOURCE ID ASSOCIATION
      let matchedExternalSource: RetrievedClinicalSource | null = null;
      if (isExternalSource) {
        if (!externalSources || externalSources.length === 0) {
          throw new Error('No authoritative external sources were retrieved for this generation.');
        }

        const rawSourceId = String(item.sourceId || '').trim();
        const cleanSourceId = rawSourceId.replace(/^\[|\]$/g, '').replace(/^"|"$/g, '').trim().toUpperCase();

        if (!cleanSourceId) {
          throw new Error(`Question ${idx + 1} is missing a sourceId. Every external question must contain an exact retrieved sourceId.`);
        }

        // Strict exact match on sourceId ONLY (e.g. PMID_12345, PMC_6789, DOI_...)
        // NO fallback by URL, journal name, title substring, positional or inferred matching
        matchedExternalSource = externalSources.find(s => s.sourceId.toUpperCase() === cleanSourceId) || null;

        if (!matchedExternalSource) {
          const validIds = externalSources.map(s => s.sourceId).join(', ');
          throw new Error(`Question ${idx + 1} cites invalid sourceId "${rawSourceId}". Must exactly match one of the retrieved source IDs: [${validIds}].`);
        }

        // Authoritative server-controlled mapping:
        // Gemini sourceId -> exact retrieved source object -> server-controlled fields
        authSource = `${matchedExternalSource.journal || matchedExternalSource.sourceName} (${matchedExternalSource.url}) [Retrieved: ${matchedExternalSource.retrievedAt}]`;
      } else {
        if (authSource.length < 3) {
          throw new Error(`Question ${idx + 1} is missing an authoritative clinical source/reference.`);
        }

        // Prohibit unverified blogs, forums, or SEO sites
        const forbiddenPatterns = [
          /\bblog\b/i,
          /\bforum\b/i,
          /\bquora\b/i,
          /\breddit\b/i,
          /\bwordpress\b/i,
          /\bmedium\.com\b/i,
          /\bwikipedia\b/i
        ];
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(authSource)) {
            throw new Error(`Question ${idx + 1} cites an unverified or informal source (${authSource}). Authoritative clinical sources or verified CNE material required.`);
          }
        }

        // Genuine grounding attribution check:
        if (/^https?:\/\//i.test(authSource) || /live online verified/i.test(authSource)) {
          authSource = `Verified CNE Material (Topic: ${authoritativeTopic}) - ${authSource.replace(/^https?:\/\/[^\/]+\/?/i, '') || 'Clinical Standard'}`;
        } else if (
          !authSource.toLowerCase().includes('cne material') &&
          !authSource.toLowerCase().includes('learning material') &&
          !authSource.toLowerCase().includes('curriculum') &&
          !authSource.toLowerCase().includes('who') &&
          !authSource.toLowerCase().includes('inc') &&
          !authSource.toLowerCase().includes('aiims') &&
          !authSource.toLowerCase().includes('mohfw') &&
          !authSource.toLowerCase().includes('cdc') &&
          !authSource.toLowerCase().includes('protocol') &&
          !authSource.toLowerCase().includes('guideline')
        ) {
          authSource = `Verified CNE Material: ${authSource}`;
        }
      }

      validatedQuestions.push({
        id: `q_ai_${Date.now()}_${idx + 1}`,
        question: qText,
        options: {
          A: optA,
          B: optB,
          C: optC,
          D: optD
        },
        correctOption: rawCorrect as 'A' | 'B' | 'C' | 'D',
        explanation: explanation,
        authoritativeSource: authSource,
        sourceUrl: matchedExternalSource ? matchedExternalSource.url : undefined,
        sourceRetrievedAt: matchedExternalSource ? matchedExternalSource.retrievedAt : undefined,
        status: 'ACTIVE' as const,
        isFinalized: true
      });
    }

    return createJsonResponse({
      success: true,
      data: validatedQuestions,
      cneId: cleanCneId,
      reservationToken: cleanToken,
      source: isExternalSource ? `External Sources (${usedModel})` : usedModel
    });
  } catch (err: any) {
    if (isExternalSource) {
      await releaseServerSideReservation(`Generation error: ${err?.message || err}`);
    }
    const isOverloaded = /503|UNAVAILABLE|high demand|429|RESOURCE_EXHAUSTED|capacity/i.test(err?.message || '');
    const clientMessage = isOverloaded
      ? 'AI question generation is temporarily unavailable. Please try again in a few moments.'
      : (err?.message ? `AI generation failed: ${err.message}` : 'Unable to generate AI questions.');
    return createJsonResponse({
      success: false,
      errorCode: isOverloaded ? 'AI_TEMPORARILY_UNAVAILABLE' : 'AI_GENERATION_ERROR',
      message: clientMessage,
      reservationReleased: isExternalSource
    }, isOverloaded ? 503 : 502);
  }
};
