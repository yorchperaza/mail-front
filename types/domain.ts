// types/domain.ts
export type CompanyBrief = { hash: string; name: string | null };

export type MxRecord = {
    host?: string;
    value?: string;
    priority?: number;
};

export type DomainDetail = {
    id: number;
    domain: string | null;
    status: 'pending' | 'active' | 'failed' | string | null;
    created_at: string | null;   // ISO
    verified_at: string | null;  // ISO
    require_tls: boolean | null;
    arc_sign: boolean | null;
    bimi_enabled: boolean | null;
    txt: { name: string | null; value: string | null } | null;
    records: {
        spf_expected: string | null;
        dmarc_expected: string | null;
        mx_expected: MxRecord[] | null;
    };
    counts: {
        cname: string;
        records: string;
        mx: number;
        keys: number;
        txt: string;
        dkimKeys: number;
        messages: number;
        tlsRptReports: number;
        mtaStsPolicies: number;
        dmarcAggregates: number;
        bimiRecords: number;
        reputation: number;
        inboundRoutes: number;
        inboundMessages: number;
        campaigns: number;
    };
    company: CompanyBrief;
};