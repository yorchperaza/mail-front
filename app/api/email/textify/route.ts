import { NextRequest, NextResponse } from 'next/server';
import { htmlToText } from 'html-to-text';

type TextifyBody = { html?: string };
type TextifyResult = { text?: string; error?: string };

export async function POST(req: NextRequest) {
    try {
        let body: TextifyBody = {};
        try {
            body = await req.json();
        } catch {
            return NextResponse.json<TextifyResult>({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const source = typeof body.html === 'string' ? body.html : undefined;
        if (!source) {
            return NextResponse.json<TextifyResult>({ error: 'html (string) required' }, { status: 400 });
        }

        const text = htmlToText(source, {
            wordwrap: 78,
            selectors: [
                { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
                { selector: 'img', format: 'skip' },
            ],
        });

        return NextResponse.json<TextifyResult>({ text });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Textify error';
        return NextResponse.json<TextifyResult>({ error: msg }, { status: 500 });
    }
}
