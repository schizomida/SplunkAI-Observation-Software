import { NextRequest, NextResponse } from 'next/server';
import {
  generateInvestigationSummary,
  generateRootCauseSummary,
  generateRemediationSummary,
  generateExecutiveSummary,
} from '@/lib/ai/summarizer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, context } = body;

    if (!type || !context) {
      return NextResponse.json(
        { summary: null, error: 'Missing type or context' },
        { status: 400 }
      );
    }

    let summary: string;

    switch (type) {
      case 'investigation':
        summary = await generateInvestigationSummary(
          context.incident,
          context.evidence,
          context.hypotheses
        );
        break;

      case 'rootcause':
        summary = await generateRootCauseSummary(
          context.hypotheses,
          context.evidence
        );
        break;

      case 'remediation':
        summary = await generateRemediationSummary(
          context.steps,
          context.hypotheses
        );
        break;

      case 'executive':
        summary = await generateExecutiveSummary(
          context.incident,
          context.result
        );
        break;

      default:
        return NextResponse.json(
          { summary: null, error: `Unknown summary type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { summary: null, error: message },
      { status: 500 }
    );
  }
}
