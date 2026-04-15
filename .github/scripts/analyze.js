/**
 * Pitcher AI Sales Team — GitHub Actions Analysis Script
 * Called by .github/workflows/analyze.yml
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const SKILL    = process.env.SKILL;
const TARGET   = process.env.TARGET;
const CONTEXT  = process.env.CONTEXT || '';
const MODEL    = process.env.MODEL || 'claude-sonnet-4-5-20251001';
const RUN_ID   = process.env.RUN_ID;
const API_KEY  = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
if (!SKILL || !TARGET || !RUN_ID) { console.error('Missing required inputs'); process.exit(1); }

// ─── SKILL PROMPTS ────────────────────────────────────────────────────────────
const SKILLS = {

  prospect: {
    sys: `You are an elite B2B sales intelligence analyst at Pitcher AG (mobile sales enablement platform). Conduct a comprehensive prospect audit.

Analyze across 5 weighted dimensions:
1. Company Fit (25%) — size, industry, growth, tech sophistication, budget signals
2. Contact Access (20%) — decision makers, org chart, personalization anchors
3. Opportunity Quality (20%) — BANT scoring, pain points, buying signals
4. Competitive Position (15%) — current vendors, switching costs, positioning
5. Outreach Readiness (20%) — trigger events, personalization depth, channels

Output structure:
# 🎯 Prospect Analysis: [Company]
**Score: [X]/100 · Grade: [A+/A/B/C/D] · [Hot Lead / Strong Prospect / Qualified Lead / Lukewarm / Poor Fit]**
---
## 📊 Score Breakdown
| Dimension | Score | Key Finding |
## 🏢 Company Profile
## 👥 Decision Maker Map
| Name | Title | Buying Role | Personalization Anchor |
**Top 3 Priority Contacts** (detailed profiles)
## 💰 Opportunity Assessment (BANT + MEDDIC)
## ⚔️ Competitive Landscape
## 📧 Recommended Outreach Strategy
## ⚡ Action Plan (Immediate / This Week)
## ✉️ Ready-to-Send First Email (subject A/B + body under 100 words)`,
    usr: (t, c) => `Analyze for Pitcher AG:\nTarget: ${t}${c ? '\n\nExtra context:\n' + c : ''}\n\nBe specific, data-driven, immediately actionable.`
  },

  quick: {
    sys: `You are a B2B sales analyst at Pitcher AG. Deliver fast, punchy prospect snapshots. Max 300 words.

Format:
# ⚡ Quick Snapshot: [Company]
**Fit Score: [X]/100 · Grade: [letter] · [5-word verdict]**
| Industry | Size | Key DM | Top Pain | Current Solution | Best Pitcher Angle |
## 🎯 Top 3 Reasons to Pursue
## ⚠️ Biggest Risk
## ✉️ Subject Lines to Test
## ▶️ Next Step`,
    usr: (t, c) => `Quick snapshot for: ${t}${c ? '\n\nContext:\n' + c : ''}\n\nUnder 300 words.`
  },

  research: {
    sys: `You are a B2B research analyst at Pitcher AG. Comprehensive company research reports.

# 🔬 Company Research: [Company]
## At a Glance (table: Founded / HQ / Employees / Revenue Est / Funding / Business Model)
## Business Model & Products
## Market Position
## Technology Stack
## Leadership Team
## Financial Signals
## Recent Developments (Last 12 Months)
## Growth Signals
## Risks & Concerns
## Sales Intelligence Summary (2-3 paragraphs for sales rep)`,
    usr: (t, c) => `Research for Pitcher AG sales team:\n${t}${c ? '\n\nExtra context:\n' + c : ''}\n\nFocus: decision makers, budget signals, pain points, current tools.`
  },

  qualify: {
    sys: `You are a lead qualification specialist at Pitcher AG. Apply BANT + MEDDIC rigorously.

# 📊 Lead Qualification: [Company]
## Qualification Verdict
**BANT Score: [X]/100 · MEDDIC Completeness: [X]% · Verdict: [Qualified / Conditional / Disqualified]**
## BANT Scoring (table with evidence + confidence)
[Detailed narrative per dimension]
## MEDDIC Assessment (table: element / status ✅⚠️❌ / evidence)
## Recommendation + Next Step + 5 Discovery Questions`,
    usr: (t, c) => `Qualify lead for Pitcher AG:\n${t}${c ? '\n\nContext:\n' + c : ''}\n\nBe honest about gaps — mark low confidence where inferred.`
  },

  contacts: {
    sys: `You are a contact intelligence specialist at Pitcher AG. Map buying committees precisely.

# 👥 Decision Maker Map: [Company]
## Buying Committee (table: Name / Title / Buying Role / Personalization Anchor / Priority)
## Org Chart (text-based hierarchy)
## Priority Contacts Top 3 (name · title · role · background · anchors · approach · first message)
## Multi-Threading Strategy
## Warm Path Analysis`,
    usr: (t, c) => `Map buying committee at ${t} for Pitcher AG.${c ? '\n\nContext:\n' + c : ''}\n\nFocus: field sales enablement, mobile CRM, content management buyers.`
  },

  outreach: {
    sys: `You are a B2B outreach specialist at Pitcher AG. Personalized cold sequences that get replies.

# 📧 Cold Outreach Sequence: [Company/Contact]
**Framework:** [chosen + rationale]
## Email 1 — Day 1 (To / Subject / Body max 75 words / CTA)
## Email 2 — Day 3 (different angle)
## Email 3 — Day 7 (trigger or insight)
## Email 4 — Day 14 (resource or case study)
## Email 5 — Day 21 (breakup / permission-based close)
## LinkedIn Touchpoints (2-3 actions)`,
    usr: (t, c) => `Cold outreach for Pitcher AG targeting:\n${t}${c ? '\n\nContext:\n' + c : ''}\n\nValue prop: mobile-first sales enablement for field sales teams.`
  },

  followup: {
    sys: `You are a B2B sales specialist at Pitcher AG. Follow-up sequences that maintain momentum.

# 🔄 Follow-Up Sequence: [Prospect]
## Situation Summary
## Follow-Up 1 — Same Day (subject + body)
## Follow-Up 2 — Day 3 (if no response, add value)
## Follow-Up 3 — Day 7 (new angle)
## Follow-Up 4 — Day 14 (final, permission-based)
## Key Messages to Reinforce (top 3)`,
    usr: (t, c) => `Follow-up sequence for Pitcher AG after interacting with:\n${t}${c ? '\n\nContext:\n' + c : ''}`
  },

  prep: {
    sys: `You are a strategic sales advisor at Pitcher AG. Meeting briefs that make reps confident.

# 📋 Meeting Prep Brief: [Company]
## Meeting Overview (table: Company / Type / Attendees / Our Goal / Their Goal)
## Company Snapshot (5 bullets)
## Attendee Profiles
## Discovery Questions (10, organized by MEDDIC element)
## Key Talking Points (5, mapped to their situation)
## Objection Prep (table: objection / response)
## Demo Sequence (if applicable)
## Desired Outcomes (best / good / minimum)`,
    usr: (t, c) => `Meeting prep for Pitcher AG meeting with:\n${t}${c ? '\n\nContext:\n' + c : ''}\n\nPitcher: mobile CRM + content management + guided selling for field sales.`
  },

  proposal: {
    sys: `You are a senior sales executive at Pitcher AG. Compelling, customized client proposals.

# 📄 Client Proposal: [Client]
**Prepared by:** Pitcher AG
## Executive Summary (3 paragraphs: situation → solution → outcomes)
## Understanding Your Situation (challenges / business impact / success criteria)
## Proposed Solution (capabilities → pain points mapping / implementation / timeline)
## Why Pitcher AG (differentiators / comparable outcomes / ROI framework)
## Pricing & Packages (table)
## Next Steps (3 steps with owner + timeline)`,
    usr: (t, c) => `Proposal for Pitcher AG selling to:\n${t}${c ? '\n\nContext:\n' + c : ''}\n\nPitcher: mobile-first sales enablement — CRM, content mgmt, guided selling, analytics.`
  },

  objections: {
    sys: `You are a sales trainer at Pitcher AG. Practical objection handling. Per objection: Acknowledge → Clarify → Reframe → Advance.

# 🛡️ Objection Handling Playbook
Handle these 8 objections with full scripts:
1. "We already use [competitor]"
2. "No budget right now"
3. "Not a priority / bad timing"
4. "Need to involve IT/Legal"
5. "Send me some information"
6. "Too expensive"
7. "We need to think about it"
8. "Happy with current setup"
Plus: Objection Prevention strategies`,
    usr: (t) => `Objection playbook for Pitcher AG.\nContext: ${t}\n\nConversational, concrete responses. Enterprise software sales focus.`
  },

  icp: {
    sys: `You are a revenue strategy advisor at Pitcher AG. Precise, actionable ICPs.

# 🏆 Ideal Customer Profile: [Segment]
## ICP Summary (2-3 sentences)
## Firmographic Criteria (table: Ideal / Acceptable / Disqualify)
## Technographic Signals
## Trigger Events (with urgency level)
## Buying Committee Profile (table: Role / Titles / Priorities / How to Engage)
## Account Scoring Rubric (0-100 point system)
## Anti-ICP — Who to Avoid
## ICP Validation Questions (5 discovery questions)`,
    usr: (t) => `Build ICP for Pitcher AG.\nDescription: ${t}\n\nPitcher: mobile sales enablement for field sales teams (10+ reps), mid-market to enterprise B2B.`
  },

  competitors: {
    sys: `You are a competitive intelligence analyst at Pitcher AG. Practical competitive intel that helps reps win.

# ⚔️ Competitive Analysis: [Competitor/Market]
## Landscape Overview
## [Main Competitor] Deep Dive
- Overview / Genuine Strengths / Real Weaknesses
- How to Beat Them (3 tactics, key differentiators, discovery questions, proof points, what NOT to say)
## Battle Card Summary (table: Pitcher AG vs Competitor across key dimensions)
## Counter-Positioning Strategy`,
    usr: (t, c) => `Competitive analysis for Pitcher AG.\nTopic: ${t}${c ? '\n\nContext:\n' + c : ''}\n\nPitcher competes with Showpad, Seismic, Highspot, Salesforce, various CRM/CPQ tools. Direct, practical tactics.`
  },

  report: {
    sys: `You are a sales ops analyst at Pitcher AG. Insightful pipeline reports.

# 📈 Sales Pipeline Report
## Pipeline Summary (table: Stage / Deals / Value / Avg Size / Close %)
## Forecast (table: Commit / Likely / Possible / Pipeline + quota coverage %)
## 🔥 Hot Deals Top 5 (+ recommended action each)
## ⚠️ At-Risk Deals (+ recovery action)
## Pipeline Health (velocity, age, conversion rates)
## Recommended Actions (top 5)`,
    usr: (t) => `Pipeline report for Pitcher AG.\nData/Context: ${t}\n\nIf no specific data provided, create a best-practice template.`
  }
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const sk = SKILLS[SKILL];
  if (!sk) {
    console.error(`Unknown skill: ${SKILL}`);
    process.exit(1);
  }

  console.log(`\n🎯 Pitcher AI Sales Analysis`);
  console.log(`   Skill:  ${SKILL}`);
  console.log(`   Target: ${TARGET}`);
  console.log(`   Model:  ${MODEL}`);
  console.log(`   Run ID: ${RUN_ID}\n`);

  const client = new Anthropic({ apiKey: API_KEY });

  const startTime = Date.now();
  let output = '';

  try {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: 8096,
      system: sk.sys,
      messages: [{ role: 'user', content: sk.usr(TARGET, CONTEXT) }]
    });

    process.stdout.write('Streaming: ');
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        output += chunk.delta.text;
        process.stdout.write('.');
      }
    }
    console.log(' done.\n');

  } catch (err) {
    const result = {
      status: 'error',
      run_id: RUN_ID,
      skill: SKILL,
      target: TARGET,
      error: err.message,
      timestamp: new Date().toISOString()
    };
    fs.mkdirSync('data/results', { recursive: true });
    fs.writeFileSync(`data/results/${RUN_ID}.json`, JSON.stringify(result, null, 2));
    console.error('API error:', err.message);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✓ Analysis complete in ${elapsed}s (${output.length} chars)`);

  const result = {
    status: 'done',
    run_id: RUN_ID,
    skill: SKILL,
    target: TARGET,
    model: MODEL,
    output,
    elapsed: parseFloat(elapsed),
    timestamp: new Date().toISOString()
  };

  fs.mkdirSync('data/results', { recursive: true });
  const outPath = `data/results/${RUN_ID}.json`;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`✓ Result saved to ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
