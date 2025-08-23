'use client';

import React from 'react';
import SetupDnsSection from '@/components/domain/SetupDnsSection';
import type { DomainDetail } from '@/types/domain';

type Props = {
    detail: DomainDetail;
    onRefresh: () => Promise<void>;
    loadingRefresh: boolean;
};

export default function RecordsTab({ detail, onRefresh, loadingRefresh }: Props) {
    return (
        <div className="space-y-8">
            <SetupDnsSection
                detail={detail}
                onRefresh={onRefresh}
                loadingRefresh={loadingRefresh}
            />
        </div>
    );
}
