import { Body, Controller, HttpCode, Injectable, Ip, Logger, Module, Post } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { assistantSchema } from '@okidoc/shared';
import { z } from 'zod';
import { Public } from '../../common/auth';
import { AppError, Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { RateLimiter } from '../../common/settings.service';
import { config } from '../../config';

/**
 * PAT-15 Assistant: suggests which specialty to see from described symptoms.
 * It never diagnoses, always carries a disclaimer, and red-flag symptoms get an emergency message.
 * With ANTHROPIC_API_KEY set it uses Claude (structured JSON output); otherwise a keyword matcher over
 * Specialty.keywords. Conversations are not stored.
 */

const DISCLAIMER: Record<string, string> = {
  en: 'Okidoc Assistant is not a doctor and does not give medical advice. For an emergency call 108 or 112.',
  bn: 'Okidoc সহকারী ডাক্তার নয় এবং চিকিৎসা পরামর্শ দেয় না। জরুরি অবস্থায় ১০৮ বা ১১২ নম্বরে ফোন করুন।',
  hi: 'Okidoc सहायक डॉक्टर नहीं है और चिकित्सा सलाह नहीं देता। आपात स्थिति में 108 या 112 पर कॉल करें।',
};

const EMERGENCY: Record<string, string> = {
  en: 'These symptoms can be serious. Please call 108 / 112 or go to the nearest emergency department now.',
  bn: 'এই উপসর্গগুলি গুরুতর হতে পারে। এখনই ১০৮ / ১১২-এ ফোন করুন বা নিকটতম জরুরি বিভাগে যান।',
  hi: 'ये लक्षण गंभीर हो सकते हैं। अभी 108 / 112 पर कॉल करें या नज़दीकी आपातकालीन विभाग जाएँ।',
};

/** Red-flag phrases (English, Bengali, Hindi / transliterated) that always trigger the emergency message. */
const RED_FLAGS = [
  'chest pain', 'chest tightness', "can't breathe", 'cannot breathe', 'difficulty breathing', 'shortness of breath',
  'unconscious', 'fainted', 'seizure', 'fits', 'stroke', 'face drooping', 'slurred speech', 'severe bleeding',
  'vomiting blood', 'blood in vomit', 'suicide', 'kill myself', 'poison', 'snake bite', 'heavy bleeding pregnancy',
  'বুকে ব্যথা', 'শ্বাসকষ্ট', 'অজ্ঞান', 'খিঁচুনি', 'রক্তবমি', 'সাপে কামড়',
  'सीने में दर्द', 'सांस लेने में तकलीफ', 'बेहोश', 'दौरा', 'खून की उल्टी', 'सांप ने काटा',
];

const AssistantReply = z.object({
  emergency: z.boolean(),
  reply: z.string(),
  specialties: z.array(z.string()).max(3),
  followUpQuestion: z.string().nullable(),
});
type AssistantReplyT = z.infer<typeof AssistantReply>;

const REPLY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    emergency: { type: 'boolean', description: 'True if the symptoms need emergency care right now.' },
    reply: { type: 'string', description: 'Short, kind reply to the patient in their language (max 3 sentences). No diagnosis, no medicine names or doses.' },
    specialties: { type: 'array', items: { type: 'string' }, description: 'Up to 3 specialty slugs from the allowed list, best first.' },
    followUpQuestion: { type: ['string', 'null'], description: 'One clarifying question if the specialty is unclear, else null.' },
  },
  required: ['emergency', 'reply', 'specialties', 'followUpQuestion'],
  additionalProperties: false,
} as const;

@Injectable()
export class AssistantService {
  private readonly log = new Logger('Assistant');
  private readonly client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 2, timeout: 30_000 }) : null;

  constructor(private readonly prisma: PrismaService) {}

  async chat(messages: { role: 'user' | 'assistant'; content: string }[], language = 'en') {
    const lang = ['en', 'bn', 'hi'].includes(language) ? language : 'en';
    const specialties = await this.prisma.specialty.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const text = lastUser.toLowerCase();

    let result: AssistantReplyT;
    if (RED_FLAGS.some((f) => text.includes(f))) {
      result = { emergency: true, reply: EMERGENCY[lang], specialties: [], followUpQuestion: null };
    } else if (this.client) {
      result = (await this.askClaude(messages, lang, specialties)) ?? this.keywordMatch(text, lang, specialties);
    } else {
      result = this.keywordMatch(text, lang, specialties);
    }
    if (result.emergency) result.reply = `${result.reply}\n\n${EMERGENCY[lang]}`;

    const matched = result.specialties
      .map((slug) => specialties.find((s) => s.slug === slug))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({ id: s.id, slug: s.slug, name: lang === 'bn' ? s.nameBn ?? s.name : lang === 'hi' ? s.nameHi ?? s.name : s.patientName ?? s.name }));
    return { ...result, specialties: matched, disclaimer: DISCLAIMER[lang], source: this.client ? 'claude' : 'rules' };
  }

  private keywordMatch(text: string, lang: string, specialties: { slug: string; keywords: string[]; name: string }[]): AssistantReplyT {
    const scored = specialties
      .map((s) => ({ slug: s.slug, score: s.keywords.filter((k) => k && text.includes(k.toLowerCase())).length }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const picks = scored.length ? scored.map((s) => s.slug) : ['general-physician'];
    const reply: Record<string, string> = {
      en: scored.length ? 'Based on what you described, these doctors may be the right place to start.' : 'A General Physician is a good first step. They can refer you to a specialist if needed.',
      bn: scored.length ? 'আপনার বর্ণনা অনুযায়ী এই ডাক্তারদের দেখানো শুরু করতে পারেন।' : 'প্রথমে একজন জেনারেল ফিজিশিয়ান দেখান। দরকার হলে তিনি বিশেষজ্ঞের কাছে পাঠাবেন।',
      hi: scored.length ? 'आपके बताए लक्षणों के अनुसार इन डॉक्टरों से शुरुआत कर सकते हैं।' : 'पहले किसी जनरल फिजिशियन को दिखाएँ। ज़रूरत हो तो वे विशेषज्ञ के पास भेजेंगे।',
    };
    return { emergency: false, reply: reply[lang], specialties: picks, followUpQuestion: null };
  }

  private async askClaude(
    messages: { role: 'user' | 'assistant'; content: string }[],
    lang: string,
    specialties: { slug: string; name: string; patientName: string | null }[],
  ): Promise<AssistantReplyT | null> {
    const langName = { en: 'English', bn: 'Bengali', hi: 'Hindi' }[lang];
    const system = [
      'You help patients in India decide which kind of doctor to book on Okidoc, a clinic queue and booking app.',
      'You are not a doctor. Never diagnose, never name medicines or doses, never reassure that something is harmless.',
      'Map the described symptoms to at most 3 specialties, using ONLY these slugs:',
      specialties.map((s) => `- ${s.slug}: ${s.patientName ?? s.name}`).join('\n'),
      'If symptoms could be an emergency (e.g. chest pain, breathing trouble, stroke signs, heavy bleeding, seizures, poisoning, suicidal thoughts), set emergency=true.',
      'If unsure, suggest general-physician and ask one short follow-up question.',
      `Write "reply" and "followUpQuestion" in ${langName}, in plain, kind, simple words.`,
    ].join('\n');
    try {
      const response = await this.client!.beta.messages.create({
        model: config.assistantModel,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: REPLY_JSON_SCHEMA } },
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      if (response.stop_reason === 'refusal') {
        this.log.warn(`Assistant refusal: ${response.stop_details?.category ?? 'unknown'}`);
        return null;
      }
      const textBlock = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text');
      if (!textBlock) return null;
      const parsed = AssistantReply.safeParse(JSON.parse(textBlock.text));
      if (!parsed.success) return null;
      const allowed = new Set(specialties.map((s) => s.slug));
      return { ...parsed.data, specialties: parsed.data.specialties.filter((s) => allowed.has(s)) };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) this.log.warn('Assistant rate limited — using keyword matcher');
      else if (error instanceof Anthropic.APIError) this.log.warn(`Assistant API error ${error.status}: ${error.message}`);
      else this.log.warn(`Assistant failed: ${String(error)}`);
      return null; // graceful fallback to the keyword matcher
    }
  }
}

@Public()
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly limiter: RateLimiter,
  ) {}

  @HttpCode(200)
  @Post('chat')
  chat(@Body(new Zod(assistantSchema)) dto: z.infer<typeof assistantSchema>, @Ip() ip: string) {
    if (!this.limiter.allow(`assistant:${ip}`, 20, 60_000)) {
      throw new AppError(429, 'RATE_LIMIT', 'Please wait a moment and try again.');
    }
    return this.assistant.chat(dto.messages, dto.language);
  }
}

@Module({ controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
