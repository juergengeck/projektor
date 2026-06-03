import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';

declare module '@OneObjectInterfaces' {
  export interface OneVersionedObjectInterfaces {
    NgoDonor: NgoDonor;
    NgoDonation: NgoDonation;
    NgoDonorChange: NgoDonorChange;
  }

  export interface OneIdObjectInterfaces {
    NgoDonor: Pick<NgoDonor, '$type$' | 'donorId'>;
    NgoDonation: Pick<NgoDonation, '$type$' | 'donationId'>;
    NgoDonorChange: Pick<NgoDonorChange, '$type$' | 'changeId'>;
  }
}

export interface NgoDonor {
  $type$: 'NgoDonor';
  donorId: string;
  name: string;
  isMember: boolean;
  email?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  memberSince?: string;
  recurringDonor: boolean;
  thanked: boolean;
  asked: boolean;
  emailMarketingConsent: boolean;
  receiptSentAt?: string;
  tags: string[];
  notes?: string;
  donations: SHA256IdHash<NgoDonation>[];
  updatedAt: number;
  schemaVersion: string;
}

export interface NgoDonation {
  $type$: 'NgoDonation';
  donationId: string;
  donor: SHA256IdHash<NgoDonor>;
  type: string;
  amount: number;
  date: string;
  purpose: string;
  thanked: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion: string;
}

export interface NgoDonorChange {
  $type$: 'NgoDonorChange';
  changeId: string;
  donor: SHA256IdHash<NgoDonor>;
  kind: string;
  createdAt: number;
  previousDonorVersion?: SHA256Hash<NgoDonor>;
  nextDonorVersion?: SHA256Hash<NgoDonor>;
  donation?: SHA256IdHash<NgoDonation>;
  reason?: string;
  schemaVersion: string;
}
