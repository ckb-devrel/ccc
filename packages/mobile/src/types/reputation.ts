/**
 * Reputation System Types
 *
 * Privacy-preserving, non-transferable reputation system based on vault behavior
 */

export enum VaultBehaviorType {
  TIME_LOCK_HONORED = 'time_lock_honored',
  COOPERATIVE_EXIT = 'cooperative_exit',
  VAULT_ABANDONED = 'vault_abandoned',
  DISPUTE_RESOLVED = 'dispute_resolved',
  EARLY_EXIT_PENALTY = 'early_exit_penalty',
}

export interface VaultAction {
  vaultId: string;
  behaviorType: VaultBehaviorType;
  timestamp: number;
  // Encrypted details - only user can decrypt
  encryptedDetails?: string;
  // Merkle proof for verification without revealing details
  merkleProof?: string[];
  merkleRoot?: string;
}

export interface ReputationScore {
  // Overall score (0-1000)
  overallScore: number;

  // Component scores
  reliabilityScore: number; // Time locks honored / total time locks
  cooperationScore: number; // Cooperative exits / total exits
  consistencyScore: number; // Vault completion rate

  // Temporal decay factor (newer actions weighted higher)
  temporalWeight: number;

  // Privacy-preserving metadata
  totalActions: number; // Fuzzy count (bucketed)
  accountAge: number; // In days, bucketed

  // Verification data
  scoreCommitment: string; // Pedersen commitment to score
  lastUpdated: number;
}

export interface ReputationAttestation {
  // What is being attested
  claimType: 'min_score' | 'behavior_count' | 'no_negative';
  claimValue: number | string;

  // Zero-knowledge proof that claim is true without revealing actual values
  proof: {
    commitment: string; // Commitment to private data
    challenge: string;
    response: string;
  };

  // Timestamp and validity
  timestamp: number;
  expiresAt: number;

  // Optional: Issuer signature (could be self-attested)
  signature?: string;
}

export interface ReputationSettings {
  // Privacy settings
  shareScore: boolean; // Allow score to be visible to others
  shareAttestations: boolean; // Allow generating attestations

  // What to include in score calculation
  includeBehaviors: VaultBehaviorType[];

  // Temporal settings
  decayEnabled: boolean; // Apply time decay to old actions
  decayHalfLife: number; // Half-life in days
}

export interface ReputationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';

  // Criteria (privacy-preserving)
  minimumScore: number;
  minimumActions: number;
  minimumAccountAge: number; // days

  // Achievement date
  earnedAt?: number;
}

// Scoring weights
export const REPUTATION_WEIGHTS = {
  TIME_LOCK_HONORED: 10,
  COOPERATIVE_EXIT: 15,
  VAULT_ABANDONED: -20,
  DISPUTE_RESOLVED: 12,
  EARLY_EXIT_PENALTY: -8,
};

// Privacy buckets for fuzzy counts
export const FUZZY_BUCKETS = {
  ACTIONS: [0, 5, 10, 25, 50, 100, 250, 500],
  AGE_DAYS: [0, 7, 30, 90, 180, 365],
};

// Sybil resistance parameters
export const SYBIL_RESISTANCE = {
  MIN_ACCOUNT_AGE_DAYS: 7, // Minimum age to earn reputation
  MIN_UNIQUE_VAULTS: 3, // Minimum unique vaults to participate
  MAX_ACTIONS_PER_DAY: 5, // Rate limit to prevent farming
  VELOCITY_THRESHOLD: 0.8, // Flag accounts with > 80% actions in short period
};

export interface ReputationPrivacyProof {
  // Prove score > threshold without revealing exact score
  type: 'range_proof' | 'threshold_proof' | 'set_membership';

  // Public parameters
  threshold?: number;
  range?: {min: number; max: number};
  set?: string[];

  // Proof data
  commitment: string;
  proof: string;
  publicInputs: string[];

  // Verification key
  verificationKey: string;
}

export interface VaultParticipation {
  vaultId: string;
  role: 'creator' | 'participant';
  joinedAt: number;
  exitedAt?: number;
  status: 'active' | 'completed' | 'abandoned' | 'disputed';
}
