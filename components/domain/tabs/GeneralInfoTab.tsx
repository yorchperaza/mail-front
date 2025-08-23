'use client';

import React from 'react';
import { OverviewSection, RelatedSection } from '@/components/domain/Sections';
import type { DomainDetail } from '@/types/domain';

type Props = {
    detail: DomainDetail;
};

export default function GeneralInfoTab({ detail }: Props) {
    const { company, verified_at, created_at } = detail;

    return (
        <div className="space-y-8">
            <OverviewSection
                created_at={created_at}
                verified_at={verified_at}
                companyName={company.name}
                require_tls={detail.require_tls}
                arc_sign={detail.arc_sign}
                bimi_enabled={detail.bimi_enabled}
            />

            <RelatedSection
                counts={{
                    dkimKeys: detail.counts.dkimKeys,
                    messages: detail.counts.messages,
                    dmarcAggregates: detail.counts.dmarcAggregates,
                }}
                companyHash={company.hash}
            />
        </div>
    );
}
