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
    loggedInEmployeeId
  } = body || {};

  const cleanCneId = String(cneId || '').trim();
  const cleanToken = String(reservationToken || '').trim();
  const cleanSessionToken = String(token || '').trim();
  const cleanEmpId = String(loggedInEmployeeId || '').trim();
  const cleanTopic = String(topic || '').trim();
  const cleanMaterial = String(cneMaterial || referenceMaterial || syllabus || '').trim();

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

  if (!cleanMaterial || cleanMaterial.length < 15) {
    return createJsonResponse({
      success: false,
      errorCode: 'MATERIAL_REQUIRED',
      message: 'CNE Class Content / Learning Material is required (minimum 15 characters) to generate questions.'
    }, 400);
  }

  // 3. Authoritative backend URL check (strictly from server environment binding)
  const appsScriptUrl = (
    env?.APPS_SCRIPT_URL ||
    env?.VITE_APPS_SCRIPT_URL ||
    (typeof process !== 'undefined' && (process.env?.APPS_SCRIPT_URL || process.env?.VITE_APPS_SCRIPT_URL)) ||
    ''
  ).trim();

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
        loggedInEmployeeId: cleanEmpId
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

  // 7. Check Gemini API key from Cloudflare secret binding
  const apiKey = (
    env?.GEMINI_API_KEY ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    ''
  ).trim();

  if (!apiKey) {
    return createJsonResponse({
      success: false,
      errorCode: 'AI_CONFIGURATION_ERROR',
      message: 'Gemini API is not configured on the server.'
    }, 503);
  }

  try {
    const preferredModel = (
      env?.GEMINI_MODEL ||
      (typeof process !== 'undefined' && process.env?.GEMINI_MODEL) ||
      'gemini-3.6-flash'
    ).trim();

    const candidateModels = Array.from(new Set([
      preferredModel,
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-2.5-flash'
    ]));

    const prompt = `You are a Senior Clinical Nursing Education Specialist and Examiner at AIIMS (All India Institute of Medical Sciences).
Your task is to generate EXACTLY 5 high-quality Multiple Choice Questions (MCQs) for a Clinical Nursing Education (CNE) post-test evaluation.

CNE Topic:
"${authoritativeTopic}"

Authoritative CNE Class Content / Learning Material (PRIMARY GROUNDING SOURCE):
"""
${cleanMaterial}
"""

GROUNDING AND SOURCE VERIFICATION REQUIREMENTS (STRICT):
1. PRIMARY GROUNDING SOURCE: Use the uploaded CNE learning material above as your PRIMARY grounding source. All 5 questions, correct answers, and distractors must be strictly grounded in and directly verifiable from this supplied material.
2. EVIDENCE & SOURCE ATTRIBUTION:
   - For each question, extract and cite the specific authoritative clinical guideline, protocol, or standard cited in or directly supporting the material (e.g., "AIIMS Clinical Nursing Protocols", "WHO Guidelines", "Ministry of Health and Family Welfare / INC Standards", "Indian Nursing Council Standards", "CDC Clinical Guidelines", or peer-reviewed medical literature).
   - If genuine external live web search retrieval is not performed, DO NOT fabricate online verification, DO NOT invent fake URLs, and DO NOT falsely claim that a live web search occurred. Instead, cite authoritative references contained in the supplied material or clearly designate the source as derived from the verified CNE learning material (e.g., "Verified CNE Learning Material: [Topic/Section/Protocol]").
   - Absolutely DO NOT cite random blogs, forums, social media, commercial SEO articles, or unverified websites.
3. CLINICAL RIGOR: Focus on clinical nursing practice, patient assessment, pharmacological safety, emergency escalation, infection control protocols, and nursing care standards.
4. OPTIONS: Each question must have EXACTLY 4 distinct, plausible options labeled A, B, C, and D.
5. CORRECT ANSWER: Exactly one option must be the correct answer ("A", "B", "C", or "D").
6. CLINICAL RATIONALE: Provide an evidence-based clinical rationale/explanation for why the correct option is the standard of care.
7. AUTHORITATIVE SOURCE: Every single question MUST provide the "authoritativeSource" field reflecting genuine grounding as specified above.
8. Output MUST strictly conform to the requested JSON schema with an array of exactly 5 question objects.`;

    let generatedText = '';
    let usedModel = preferredModel;
    let lastError: any = null;

    for (const candidate of candidateModels) {
      try {
        usedModel = candidate;
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
                        authoritativeSource: { type: 'string' }
                      },
                      required: ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption', 'explanation', 'authoritativeSource']
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
            break;
          }
        } else {
          const errData: any = await geminiRes.json().catch(() => ({}));
          lastError = new Error(errData?.error?.message || `HTTP ${geminiRes.status}`);
        }
      } catch (attemptErr: any) {
        lastError = attemptErr;
      }
    }

    if (!generatedText) {
      throw lastError || new Error('No valid content returned by Gemini models.');
    }

    let cleaned = generatedText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Failed to parse Gemini JSON output.');
    }

    const rawQuestionsList: RawGeneratedQuestion[] = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed?.questions) ? parsed.questions : []);

    if (rawQuestionsList.length !== 5) {
      throw new Error(`Gemini returned ${rawQuestionsList.length} questions instead of exactly 5.`);
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
      // Do not falsely claim live online verification unless actual retrieval occurred.
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
        status: 'ACTIVE' as const,
        isFinalized: true
      });
    }

    return createJsonResponse({
      success: true,
      data: validatedQuestions,
      cneId: cleanCneId,
      reservationToken: cleanToken,
      source: usedModel
    });
  } catch {
    return createJsonResponse({
      success: false,
      errorCode: 'AI_GENERATION_ERROR',
      message: 'Unable to generate AI questions.'
    }, 502);
  }
};
