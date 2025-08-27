import { NextRequest, NextResponse } from 'next/server';

// juice needs Node APIs — do NOT run on edge
export const runtime = 'nodejs';

import juice from 'juice';

type InlineBody = { html?: string };
type InlineResult = { html?: string; error?: string };

export async function POST(req: NextRequest) {
    try {
        let body: InlineBody = {};
        try {
            body = await req.json();
        } catch {
            return NextResponse.json<InlineResult>({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const source = typeof body.html === 'string' ? body.html : undefined;
        if (!source) {
            return NextResponse.json<InlineResult>({ error: 'html (string) required' }, { status: 400 });
        }

        // Inline CSS from <style> tags and style attributes
        const html = juice(source);

        return NextResponse.json<InlineResult>({ html });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Inline error';
        return NextResponse.json<InlineResult>({ error: msg }, { status: 500 });
    }
}
