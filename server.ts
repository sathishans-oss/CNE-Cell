import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
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
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Safe JSON error handling middleware for malformed request bodies
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_REQUEST',
        message: 'Invalid JSON payload in request body.'
      });
    }
    next(err);
  });

  // Guarantee application/json header for all API routes
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'CNE Management System API',
      aiAvailable: !!process.env.GEMINI_API_KEY,
      model: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
      timestamp: new Date().toISOString()
    });
  });

  // AI Question Generation Endpoint (Gemini 2.5 Flash)
  // Strictly generates exactly 10 MCQs from CNE Topic + Unified Learning Material.
  // Authoritatively verified against Apps Script session and active quota reservation before invoking Gemini.
  // Never falls back silently to mock or static questions.
  app.post('/api/ai/generate-questions', async (req, res) => {
    const {
      cneId,
      topic,
      cneMaterial,
      referenceMaterial,
      syllabus,
      reservationToken,
      token,
      loggedInEmployeeId
    } = req.body || {};

    const cleanCneId = String(cneId || '').trim();
    const cleanToken = String(reservationToken || '').trim();
    const cleanSessionToken = String(token || '').trim();
    const cleanEmpId = String(loggedInEmployeeId || '').trim();
    const cleanTopic = String(topic || '').trim();
    const cleanMaterial = String(cneMaterial || referenceMaterial || syllabus || '').trim();

    // 1. Validate required basic parameters before network calls
    if (!cleanSessionToken) {
      return res.status(401).json({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Authentication session token is required to generate AI questions. Please sign in.'
      });
    }

    if (!cleanCneId) {
      return res.status(400).json({
        success: false,
        errorCode: 'CNE_ID_REQUIRED',
        message: 'CNE ID is required.'
      });
    }

    if (!cleanToken) {
      return res.status(403).json({
        success: false,
        errorCode: 'RESERVATION_TOKEN_REQUIRED',
        message: 'A valid AI quota reservation token is required before invoking question generation.'
      });
    }

    if (!cleanMaterial || cleanMaterial.length < 15) {
      return res.status(400).json({
        success: false,
        errorCode: 'MATERIAL_REQUIRED',
        message: 'CNE Class Content / Learning Material is required (minimum 15 characters) to generate questions.'
      });
    }

    // 2. Authoritative backend URL check (strictly from server environment, never from client)
    const appsScriptUrl = (process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || '').trim();
    if (!appsScriptUrl) {
      return res.status(503).json({
        success: false,
        errorCode: 'BACKEND_NOT_CONFIGURED',
        message: 'Authoritative Apps Script backend service URL is not configured on the server.'
      });
    }

    // 3. Authoritatively validate session, CNE authorization, and quota reservation against Apps Script
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
        return res.status(502).json({
          success: false,
          errorCode: 'AUTH_SERVICE_ERROR',
          message: 'Failed to communicate with authoritative authentication service.'
        });
      }

      authResult = await authRes.json();
    } catch (fetchErr: any) {
      console.error('[Express Auth Verification Error]', fetchErr.message);
      return res.status(502).json({
        success: false,
        errorCode: 'AUTH_SERVICE_UNAVAILABLE',
        message: 'Authoritative authentication service is unreachable. Question generation aborted.'
      });
    }

    // 4. Evaluate authoritative Apps Script authorization verdict
    if (!authResult || !authResult.success) {
      const errCode = authResult?.errorCode || 'UNAUTHORIZED';
      const statusCode = (errCode === 'UNAUTHORIZED') ? 401 : 403;
      return res.status(statusCode).json({
        success: false,
        errorCode: errCode,
        message: authResult?.message || 'Authoritative authorization or quota reservation validation failed.'
      });
    }

    // 5. Anti-parameter substitution: ensure reservation belongs strictly to requested CNE record
    const verifiedCneId = String(authResult.data?.cneId || '').trim();
    const verifiedToken = String(authResult.data?.reservationToken || '').trim();
    if (
      !verifiedCneId ||
      verifiedCneId.toUpperCase() !== cleanCneId.toUpperCase() ||
      verifiedToken !== cleanToken
    ) {
      return res.status(403).json({
        success: false,
        errorCode: 'PARAMETER_SUBSTITUTION_DETECTED',
        message: 'Reservation token does not match the requested CNE record.'
      });
    }

    const authoritativeTopic = String(authResult.data?.topic || cleanTopic).trim();
    if (!authoritativeTopic) {
      return res.status(400).json({
        success: false,
        errorCode: 'TOPIC_REQUIRED',
        message: 'CNE Topic is required for generating questions.'
      });
    }

    // 6. Check Gemini client availability
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        errorCode: 'AI_CONFIGURATION_ERROR',
        message: 'Gemini API is not configured on the server.'
      });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        errorCode: 'AI_CONFIGURATION_ERROR',
        message: 'Gemini API is not configured on the server.'
      });
    }

    try {
      const preferredModel = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
      const candidateModels = Array.from(new Set([
        preferredModel,
        'gemini-2.5-flash',
        'gemini-3.6-flash',
        'gemini-3.8-flash'
      ]));

      const prompt = `You are a Senior Clinical Nursing Education Specialist and Examiner at AIIMS (All India Institute of Medical Sciences).
Your task is to generate EXACTLY 10 high-quality Multiple Choice Questions (MCQs) for a Clinical Nursing Education (CNE) post-test evaluation.

CNE Topic:
"${authoritativeTopic}"

Authoritative CNE Class Content / Learning Material:
"""
${cleanMaterial}
"""

STRICT CLINICAL NURSING EDUCATION REQUIREMENTS:
1. Generate EXACTLY 10 MCQs based directly and primarily on the supplied CNE learning material and topic.
2. Focus on clinical nursing practice, patient assessment, pharmacological safety, emergency escalation, infection control protocols, and nursing care standards.
3. Do NOT invent unsupported facts or introduce unrelated clinical topics.
4. Each question must have EXACTLY 4 distinct, plausible options labeled A, B, C, and D.
5. Exactly one option must be the correct answer ("A", "B", "C", or "D").
6. Provide an evidence-based clinical rationale/explanation for why the correct option is the standard of care.
7. Avoid ambiguous wording, trick questions, or duplicate questions.
8. Output MUST strictly conform to the requested JSON schema with an array of exactly 10 question objects.`;

      let response: any = null;
      let usedModel = preferredModel;
      let lastAiErr: any = null;

      for (const candidate of candidateModels) {
        try {
          usedModel = candidate;
          response = await ai.models.generateContent({
            model: candidate,
            contents: prompt,
            config: {
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
                        explanation: { type: 'string' }
                      },
                      required: ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption', 'explanation']
                    }
                  }
                },
                required: ['questions']
              }
            }
          });
          if (response?.text) {
            lastAiErr = null;
            break;
          }
        } catch (attemptErr: any) {
          lastAiErr = attemptErr;
          console.warn(`[AI Generation] Model ${candidate} failed: ${attemptErr?.message || attemptErr}. Trying next candidate if available...`);
        }
      }

      if (!response || !response.text) {
        throw lastAiErr || new Error('No response returned from Gemini AI models.');
      }

      const responseText = response.text || '';
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error('Failed to parse Gemini JSON output.');
      }

      const rawQuestionsList: RawGeneratedQuestion[] = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.questions) ? parsed.questions : []);

      // Strict validation: Must have exactly 10 questions
      if (rawQuestionsList.length !== 10) {
        throw new Error(`Gemini returned ${rawQuestionsList.length} questions instead of exactly 10.`);
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

        // Verify options are distinct
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
          // CRITICAL: AI-generated questions MUST initially be treated as DRAFT questions
          isFinalized: false
        });
      }

      return res.json({
        success: true,
        data: validatedQuestions,
        cneId: cleanCneId,
        reservationToken: cleanToken,
        source: usedModel
      });
    } catch (err: any) {
      console.error('[AI Generator Error]', err.message);
      return res.status(502).json({
        success: false,
        errorCode: 'AI_GENERATION_ERROR',
        message: 'Unable to generate AI questions.'
      });
    }
  });

  // Catch-all route for any unhandled /api calls to prevent HTML fall-through
  app.all('/api/*all', (req, res) => {
    res.status(404).json({
      success: false,
      errorCode: 'NOT_FOUND',
      message: 'API endpoint not found.'
    });
  });

  // API error middleware to catch any unexpected server exceptions and return strict JSON
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Server Error]', err?.message || err);
    res.status(500).json({
      success: false,
      errorCode: 'AI_GENERATION_ERROR',
      message: 'Unable to generate AI questions.'
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express v5 wildcard route
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CNE Management System server running on http://localhost:${PORT}`);
  });
}

startServer();
