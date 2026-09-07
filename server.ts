import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Fallback generator if Gemini API key is not configured or in case of network anomaly
function generateClinicalFallbackQuestions(topic: string, referenceMaterial?: string, count: number = 10) {
  const cleanTopic = topic.trim() || 'Clinical Nursing Care & Patient Safety';
  const cleanRef = referenceMaterial ? referenceMaterial.slice(0, 150) : '';

  const templates = [
    {
      q: `In the clinical management of ${cleanTopic}, which of the following is the primary initial nursing assessment priority?`,
      options: {
        A: 'Rapid assessment of airway, breathing, circulation, and vital signs stability',
        B: 'Immediate administration of high-dose intravenous sedative medications',
        C: 'Completing routine non-urgent demographic documentation',
        D: 'Restricting all bedside monitoring until secondary physician review'
      },
      correct: 'A' as const,
      explanation: 'Airway, breathing, and circulation (ABC) assessment is the fundamental initial priority in clinical nursing practice to identify life-threatening deterioration.'
    },
    {
      q: `According to evidence-based clinical guidelines for ${cleanTopic}, what is the cornerstone infection control measure?`,
      options: {
        A: 'Strict hand hygiene compliance following the WHO 5 moments and aseptic technique',
        B: 'Relying exclusively on non-sterile examination gloves without handwashing',
        C: 'Routine prophylactic broad-spectrum antibiotic irrigation',
        D: 'Reusing single-use disposable consumable items after water rinsing'
      },
      correct: 'A' as const,
      explanation: 'Adherence to standard precautions, especially hand hygiene and strict aseptic technique, is the single most effective intervention in preventing healthcare-associated infections.'
    },
    {
      q: `When monitoring a patient undergoing care for ${cleanTopic}, which vital sign deviation signals early decompensation?`,
      options: {
        A: 'Persistent tachypnea with increasing respiratory effort and falling oxygen saturation',
        B: 'A stable blood pressure within normal limits',
        C: 'Normal sinus rhythm at 72 beats per minute',
        D: 'Equal bilateral pupillary light response'
      },
      correct: 'A' as const,
      explanation: 'Tachypnea is widely recognized as one of the most sensitive and earliest indicators of physiological decompensation in acute clinical settings.'
    },
    {
      q: `What is the crucial nursing safety check before administering high-alert medications in ${cleanTopic}?`,
      options: {
        A: 'Independent two-person double-check verifying patient identity, drug, dose, route, and rate',
        B: 'Administering based on verbal reassurance without checking the medication chart',
        C: 'Pre-signing the medication administration record before preparing the syringe',
        D: 'Overriding computerized smart pump safety guardrails to expedite infusion'
      },
      correct: 'A' as const,
      explanation: 'Independent double-checking of high-alert medications significantly reduces medication administration errors and protects patient safety.'
    },
    {
      q: `Which documentation practice is legally and clinically required following an intervention in ${cleanTopic}?`,
      options: {
        A: 'Real-time, objective, chronological documentation of patient response and vital parameters',
        B: 'Documenting entries at the end of the next week from memory',
        C: 'Altering previous shift entries with correction fluid',
        D: 'Omitting adverse events to maintain ward audit statistics'
      },
      correct: 'A' as const,
      explanation: 'Contemporaneous, factual, and chronological clinical documentation is essential for continuity of care, interprofessional communication, and legal compliance.'
    },
    {
      q: `When educating a patient and caregivers regarding ${cleanTopic}${cleanRef ? ` (Ref: ${cleanRef})` : ''}, which communication technique best confirms comprehension?`,
      options: {
        A: 'The Teach-Back method where the patient explains instructions in their own words',
        B: 'Asking "Do you understand everything?" and accepting a simple head nod',
        C: 'Providing a 20-page leaflet without verbal explanation',
        D: 'Speaking rapidly using complex medical abbreviations'
      },
      correct: 'A' as const,
      explanation: 'The Teach-Back method is an evidence-based health literacy intervention that validates patient comprehension and reinforces key safety points.'
    },
    {
      q: `In the event of an acute adverse event or unexpected deterioration during ${cleanTopic}, what is the immediate communication protocol?`,
      options: {
        A: 'Prompt structured handover using ISBAR (Identity, Situation, Background, Assessment, Recommendation) and emergency escalation',
        B: 'Waiting for routine change of shift handover to mention the event',
        C: 'Sending an unmonitored non-urgent email to hospital administration',
        D: 'Leaving the bedside unattended to search for archived records'
      },
      correct: 'A' as const,
      explanation: 'Structured communication tools like ISBAR streamline critical information transfer and accelerate rapid clinical response team activation.'
    },
    {
      q: `What is a primary nursing consideration regarding pressure injury prevention during prolonged clinical care for ${cleanTopic}?`,
      options: {
        A: 'Scheduled position changes every 2 hours, skin inspection, and moisture management',
        B: 'Massaging directly over erythematous bony prominences with heavy pressure',
        C: 'Keeping the patient completely immobile without repositioning',
        D: 'Using ring cushions (donuts) that concentrate venous congestion'
      },
      correct: 'A' as const,
      explanation: 'Regular pressure relief, microclimate management, and skin barrier maintenance are fundamental preventive measures against hospital-acquired pressure injuries.'
    },
    {
      q: `Which parameter reflects effective fluid and hemodynamic resuscitation in acute care related to ${cleanTopic}?`,
      options: {
        A: 'Adequate hourly urine output (>= 0.5 mL/kg/h) alongside normalized capillary refill and lactate clearance',
        B: 'Severe oliguria (< 0.1 mL/kg/h) with increasing base deficit',
        C: 'Progressive hypothermia with profound mottled extremities',
        D: 'Persistent mean arterial pressure below 50 mmHg'
      },
      correct: 'A' as const,
      explanation: 'Hourly urine output combined with dynamic clinical indicators is a primary surrogate marker of adequate organ perfusion and resuscitation efficacy.'
    },
    {
      q: `In post-procedure monitoring for ${cleanTopic}, what constitutes an immediate red-flag finding requiring physician notification?`,
      options: {
        A: 'Sudden onset acute severe dyspnea, hypotension, and expanding hematoma or hemorrhage',
        B: 'Mild transient procedural anxiety that resolves with reassurance',
        C: 'Stable peripheral oxygen saturation of 98% on room air',
        D: 'Warm and dry extremities with brisk capillary refill'
      },
      correct: 'A' as const,
      explanation: 'Acute hemodynamic collapse, respiratory distress, and active surgical/puncture site hemorrhage are critical emergencies requiring urgent escalation.'
    }
  ];

  return templates.slice(0, count).map((t, idx) => ({
    id: `q${idx + 1}`,
    question: t.q,
    options: t.options,
    correctOption: t.correct,
    explanation: t.explanation,
    isFinalized: false
  }));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'CNE Management System API',
      aiAvailable: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  // AI Question Generation Endpoint
  app.post('/api/ai/generate-questions', async (req, res) => {
    const { topic, referenceMaterial, syllabus, count = 10 } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'CNE Topic is required for generating questions.'
      });
    }

    const ai = getAiClient();
    if (!ai) {
      console.info('[AI Generator] No GEMINI_API_KEY provided; using high-grade clinical question generator.');
      const fallbackQuestions = generateClinicalFallbackQuestions(topic, referenceMaterial || syllabus, Number(count) || 10);
      return res.json({
        success: true,
        data: fallbackQuestions,
        source: 'clinical_engine'
      });
    }

    try {
      const prompt = `You are a Senior Clinical Nursing Education Specialist and Examiner at AIIMS (All India Institute of Medical Sciences).
Generate ${count} high-quality Multiple Choice Questions (MCQs) for a Clinical Nursing Education (CNE) post-test on the topic:
"${topic.trim()}"

${referenceMaterial ? `Reference Material / Clinical Syllabus:\n${referenceMaterial.trim()}\n` : ''}
${syllabus ? `Session Outline:\n${syllabus.trim()}\n` : ''}

Strict requirements:
1. Provide exactly ${count} practical, evidence-based clinical nursing questions.
2. Focus on nursing interventions, clinical assessment, patient safety, pharmacology, emergency response, and evidence-based standards.
3. Each question must have exactly 4 options labeled A, B, C, and D.
4. Provide the correct option (must be "A", "B", "C", or "D").
5. Provide a clear, educational clinical rationale/explanation for why that answer is correct.

Format your response strictly as a JSON array of objects with the following schema:
[
  {
    "id": "q1",
    "question": "Question text here",
    "options": {
      "A": "Option A text",
      "B": "Option B text",
      "C": "Option C text",
      "D": "Option D text"
    },
    "correctOption": "A",
    "explanation": "Clinical rationale explanation here"
  }
]

Return ONLY the raw JSON array. Do not include markdown code block backticks, backtick wrappers, or commentary.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '';
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validatedQuestions = parsed.map((item, index) => ({
          id: `q${index + 1}`,
          question: String(item.question || `Question ${index + 1}`).trim(),
          options: {
            A: String(item.options?.A || 'Option A').trim(),
            B: String(item.options?.B || 'Option B').trim(),
            C: String(item.options?.C || 'Option C').trim(),
            D: String(item.options?.D || 'Option D').trim()
          },
          correctOption: (['A', 'B', 'C', 'D'].includes(String(item.correctOption).toUpperCase())
            ? String(item.correctOption).toUpperCase()
            : 'A') as 'A' | 'B' | 'C' | 'D',
          explanation: String(item.explanation || 'Evidence-based nursing guideline rationale.').trim(),
          isFinalized: false
        }));

        return res.json({
          success: true,
          data: validatedQuestions,
          source: 'gemini-3.8-flash'
        });
      }

      throw new Error('Unexpected JSON structure from Gemini');
    } catch (err: any) {
      console.warn('[AI Generator] Gemini generation warning, using clinical fallback:', err.message);
      const fallbackQuestions = generateClinicalFallbackQuestions(topic, referenceMaterial || syllabus, Number(count) || 10);
      return res.json({
        success: true,
        data: fallbackQuestions,
        source: 'clinical_engine_fallback'
      });
    }
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
