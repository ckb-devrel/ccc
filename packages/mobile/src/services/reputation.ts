import {ccc} from '@ckb-ccc/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VaultAction,
  VaultBehaviorType,
  ReputationScore,
  ReputationSettings,
  ReputationAttestation,
  ReputationBadge,
  ReputationPrivacyProof,
  VaultParticipation,
  REPUTATION_WEIGHTS,
  FUZZY_BUCKETS,
  SYBIL_RESISTANCE,
} from '../types/reputation';

const STORAGE_KEYS = {
  VAULT_ACTIONS: '@reputation_vault_actions',
  REPUTATION_SCORE: '@reputation_score',
  SETTINGS: '@reputation_settings',
  BADGES: '@reputation_badges',
  VAULT_PARTICIPATIONS: '@reputation_vault_participations',
  ACCOUNT_CREATED: '@reputation_account_created',
};

export class ReputationService {
  /**
   * Record a vault action for reputation tracking
   */
  static async recordVaultAction(
    vaultId: string,
    behaviorType: VaultBehaviorType,
    details?: any,
  ): Promise<void> {
    try {
      // Check rate limiting for sybil resistance
      const canRecord = await this.checkRateLimit();
      if (!canRecord) {
        console.warn('Rate limit exceeded for reputation actions');
        return;
      }

      const action: VaultAction = {
        vaultId,
        behaviorType,
        timestamp: Date.now(),
        // Encrypt sensitive details
        encryptedDetails: details ? await this.encryptDetails(details) : undefined,
      };

      const actions = await this.getVaultActions();
      actions.push(action);

      // Keep only recent actions to prevent storage bloat
      const maxActions = 1000;
      const trimmedActions =
        actions.length > maxActions
          ? actions.slice(-maxActions)
          : actions;

      await AsyncStorage.setItem(
        STORAGE_KEYS.VAULT_ACTIONS,
        JSON.stringify(trimmedActions),
      );

      // Recalculate score
      await this.updateReputationScore();
    } catch (error) {
      console.error('Failed to record vault action:', error);
    }
  }

  /**
   * Get all vault actions
   */
  static async getVaultActions(): Promise<VaultAction[]> {
    try {
      const actionsJson = await AsyncStorage.getItem(STORAGE_KEYS.VAULT_ACTIONS);
      return actionsJson ? JSON.parse(actionsJson) : [];
    } catch (error) {
      console.error('Failed to get vault actions:', error);
      return [];
    }
  }

  /**
   * Calculate reputation score from vault actions
   */
  static async calculateReputationScore(): Promise<ReputationScore> {
    const actions = await this.getVaultActions();
    const settings = await this.getSettings();
    const accountAge = await this.getAccountAge();

    // Filter by included behaviors
    const includedActions = actions.filter(action =>
      settings.includeBehaviors.includes(action.behaviorType),
    );

    if (includedActions.length === 0) {
      return {
        overallScore: 0,
        reliabilityScore: 0,
        cooperationScore: 0,
        consistencyScore: 0,
        temporalWeight: 1,
        totalActions: 0,
        accountAge: this.bucketValue(accountAge, FUZZY_BUCKETS.AGE_DAYS),
        scoreCommitment: await this.generateCommitment(0),
        lastUpdated: Date.now(),
      };
    }

    // Calculate component scores with temporal decay
    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;

    for (const action of includedActions) {
      const weight = REPUTATION_WEIGHTS[action.behaviorType] || 0;
      const ageInDays = (now - action.timestamp) / (1000 * 60 * 60 * 24);

      // Apply temporal decay if enabled
      let decayFactor = 1;
      if (settings.decayEnabled) {
        decayFactor = Math.exp(-ageInDays / settings.decayHalfLife);
      }

      weightedSum += weight * decayFactor;
      totalWeight += Math.abs(weight) * decayFactor;
    }

    // Normalize to 0-1000 range
    const rawScore = totalWeight > 0 ? (weightedSum / totalWeight) * 500 + 500 : 500;
    const overallScore = Math.max(0, Math.min(1000, rawScore));

    // Calculate component scores
    const timeLockActions = includedActions.filter(
      a => a.behaviorType === VaultBehaviorType.TIME_LOCK_HONORED,
    );
    const cooperativeActions = includedActions.filter(
      a => a.behaviorType === VaultBehaviorType.COOPERATIVE_EXIT,
    );

    const participations = await this.getVaultParticipations();
    const completedVaults = participations.filter(p => p.status === 'completed').length;
    const totalVaults = participations.length;

    return {
      overallScore: Math.round(overallScore),
      reliabilityScore: timeLockActions.length > 0 ?
        timeLockActions.length / (timeLockActions.length + 1) : 0,
      cooperationScore: cooperativeActions.length > 0 ?
        cooperativeActions.length / (cooperativeActions.length + 1) : 0,
      consistencyScore: totalVaults > 0 ? completedVaults / totalVaults : 0,
      temporalWeight: settings.decayEnabled ? 1 / settings.decayHalfLife : 1,
      totalActions: this.bucketValue(includedActions.length, FUZZY_BUCKETS.ACTIONS),
      accountAge: this.bucketValue(accountAge, FUZZY_BUCKETS.AGE_DAYS),
      scoreCommitment: await this.generateCommitment(overallScore),
      lastUpdated: now,
    };
  }

  /**
   * Update and store reputation score
   */
  static async updateReputationScore(): Promise<void> {
    try {
      const score = await this.calculateReputationScore();
      await AsyncStorage.setItem(
        STORAGE_KEYS.REPUTATION_SCORE,
        JSON.stringify(score),
      );

      // Check and award badges
      await this.checkBadges(score);
    } catch (error) {
      console.error('Failed to update reputation score:', error);
    }
  }

  /**
   * Get current reputation score
   */
  static async getReputationScore(): Promise<ReputationScore | null> {
    try {
      const scoreJson = await AsyncStorage.getItem(STORAGE_KEYS.REPUTATION_SCORE);
      return scoreJson ? JSON.parse(scoreJson) : null;
    } catch (error) {
      console.error('Failed to get reputation score:', error);
      return null;
    }
  }

  /**
   * Generate privacy-preserving attestation
   */
  static async generateAttestation(
    claimType: 'min_score' | 'behavior_count' | 'no_negative',
    claimValue: number | string,
  ): Promise<ReputationAttestation> {
    const score = await this.getReputationScore();
    if (!score) {
      throw new Error('No reputation score available');
    }

    // Generate zero-knowledge proof
    const proof = await this.generateZKProof(score, claimType, claimValue);

    return {
      claimType,
      claimValue,
      proof,
      timestamp: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
  }

  /**
   * Verify attestation
   */
  static async verifyAttestation(
    attestation: ReputationAttestation,
  ): Promise<boolean> {
    try {
      // Check expiration
      if (Date.now() > attestation.expiresAt) {
        return false;
      }

      // Verify zero-knowledge proof
      return await this.verifyZKProof(attestation);
    } catch (error) {
      console.error('Failed to verify attestation:', error);
      return false;
    }
  }

  /**
   * Get or initialize reputation settings
   */
  static async getSettings(): Promise<ReputationSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settingsJson) {
        return JSON.parse(settingsJson);
      }

      // Default settings
      const defaultSettings: ReputationSettings = {
        shareScore: false,
        shareAttestations: false,
        includeBehaviors: Object.values(VaultBehaviorType),
        decayEnabled: true,
        decayHalfLife: 180, // 180 days
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify(defaultSettings),
      );
      return defaultSettings;
    } catch (error) {
      console.error('Failed to get reputation settings:', error);
      throw error;
    }
  }

  /**
   * Update reputation settings
   */
  static async updateSettings(
    settings: Partial<ReputationSettings>,
  ): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = {...currentSettings, ...settings};

      await AsyncStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify(updatedSettings),
      );

      // Recalculate score with new settings
      await this.updateReputationScore();
    } catch (error) {
      console.error('Failed to update reputation settings:', error);
      throw error;
    }
  }

  /**
   * Record vault participation
   */
  static async recordVaultParticipation(
    participation: VaultParticipation,
  ): Promise<void> {
    try {
      const participations = await this.getVaultParticipations();

      // Update or add participation
      const existingIndex = participations.findIndex(
        p => p.vaultId === participation.vaultId,
      );

      if (existingIndex >= 0) {
        participations[existingIndex] = participation;
      } else {
        participations.push(participation);
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.VAULT_PARTICIPATIONS,
        JSON.stringify(participations),
      );
    } catch (error) {
      console.error('Failed to record vault participation:', error);
    }
  }

  /**
   * Get vault participations
   */
  static async getVaultParticipations(): Promise<VaultParticipation[]> {
    try {
      const participationsJson = await AsyncStorage.getItem(
        STORAGE_KEYS.VAULT_PARTICIPATIONS,
      );
      return participationsJson ? JSON.parse(participationsJson) : [];
    } catch (error) {
      console.error('Failed to get vault participations:', error);
      return [];
    }
  }

  /**
   * Check and award badges based on score
   */
  private static async checkBadges(score: ReputationScore): Promise<void> {
    const badges = await this.getAvailableBadges();
    const earnedBadges = await this.getEarnedBadges();

    for (const badge of badges) {
      // Check if already earned
      if (earnedBadges.some(b => b.id === badge.id)) {
        continue;
      }

      // Check criteria
      const meetsScore = score.overallScore >= badge.minimumScore;
      const meetsActions = score.totalActions >= badge.minimumActions;
      const meetsAge = score.accountAge >= badge.minimumAccountAge;

      if (meetsScore && meetsActions && meetsAge) {
        // Award badge
        badge.earnedAt = Date.now();
        earnedBadges.push(badge);
      }
    }

    await AsyncStorage.setItem(
      STORAGE_KEYS.BADGES,
      JSON.stringify(earnedBadges),
    );
  }

  /**
   * Get available badges
   */
  static async getAvailableBadges(): Promise<ReputationBadge[]> {
    return [
      {
        id: 'reliable_newcomer',
        name: 'Reliable Newcomer',
        description: 'Honored first time locks and cooperative exits',
        icon: 'shield-check',
        tier: 'bronze',
        minimumScore: 600,
        minimumActions: 5,
        minimumAccountAge: 7,
      },
      {
        id: 'trusted_participant',
        name: 'Trusted Participant',
        description: 'Consistent positive vault behavior',
        icon: 'account-star',
        tier: 'silver',
        minimumScore: 750,
        minimumActions: 25,
        minimumAccountAge: 30,
      },
      {
        id: 'vault_veteran',
        name: 'Vault Veteran',
        description: 'Extensive reliable participation history',
        icon: 'trophy',
        tier: 'gold',
        minimumScore: 850,
        minimumActions: 100,
        minimumAccountAge: 90,
      },
      {
        id: 'exemplary_guardian',
        name: 'Exemplary Guardian',
        description: 'Outstanding track record in all vault activities',
        icon: 'star-circle',
        tier: 'platinum',
        minimumScore: 950,
        minimumActions: 250,
        minimumAccountAge: 180,
      },
    ];
  }

  /**
   * Get earned badges
   */
  static async getEarnedBadges(): Promise<ReputationBadge[]> {
    try {
      const badgesJson = await AsyncStorage.getItem(STORAGE_KEYS.BADGES);
      return badgesJson ? JSON.parse(badgesJson) : [];
    } catch (error) {
      console.error('Failed to get earned badges:', error);
      return [];
    }
  }

  /**
   * Get account age in days
   */
  private static async getAccountAge(): Promise<number> {
    try {
      const createdJson = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT_CREATED);
      const createdAt = createdJson ? parseInt(createdJson) : Date.now();

      if (!createdJson) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.ACCOUNT_CREATED,
          createdAt.toString(),
        );
      }

      return (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    } catch (error) {
      console.error('Failed to get account age:', error);
      return 0;
    }
  }

  /**
   * Bucket a value for privacy (fuzzy count)
   */
  private static bucketValue(value: number, buckets: number[]): number {
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (value >= buckets[i]) {
        return buckets[i];
      }
    }
    return buckets[0];
  }

  /**
   * Generate Pedersen commitment (simplified - would use proper crypto in production)
   */
  private static async generateCommitment(value: number): Promise<string> {
    // In production, use proper Pedersen commitment with cryptographic library
    // For now, use hash-based commitment
    const randomness = crypto.getRandomValues(new Uint8Array(32));
    const data = new TextEncoder().encode(`${value}:${Array.from(randomness).join(',')}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return ccc.hexFrom(new Uint8Array(hashBuffer));
  }

  /**
   * Generate zero-knowledge proof (simplified)
   */
  private static async generateZKProof(
    score: ReputationScore,
    claimType: string,
    claimValue: number | string,
  ): Promise<{commitment: string; challenge: string; response: string}> {
    // Simplified ZK proof - in production use proper ZK library
    const commitment = await this.generateCommitment(score.overallScore);

    // Generate challenge (Fiat-Shamir heuristic)
    const challengeData = new TextEncoder().encode(
      `${commitment}:${claimType}:${claimValue}`,
    );
    const challengeBuffer = await crypto.subtle.digest('SHA-256', challengeData);
    const challenge = ccc.hexFrom(new Uint8Array(challengeBuffer));

    // Generate response
    const responseData = new TextEncoder().encode(
      `${challenge}:${score.overallScore}`,
    );
    const responseBuffer = await crypto.subtle.digest('SHA-256', responseData);
    const response = ccc.hexFrom(new Uint8Array(responseBuffer));

    return {commitment, challenge, response};
  }

  /**
   * Verify zero-knowledge proof (simplified)
   */
  private static async verifyZKProof(
    attestation: ReputationAttestation,
  ): Promise<boolean> {
    // Simplified verification - in production use proper ZK verification
    // Verify the proof structure is valid
    return (
      attestation.proof.commitment.length > 0 &&
      attestation.proof.challenge.length > 0 &&
      attestation.proof.response.length > 0
    );
  }

  /**
   * Encrypt sensitive details
   */
  private static async encryptDetails(details: any): Promise<string> {
    // In production, use proper encryption with user's key
    // For now, just base64 encode
    return Buffer.from(JSON.stringify(details)).toString('base64');
  }

  /**
   * Check rate limiting for sybil resistance
   */
  private static async checkRateLimit(): Promise<boolean> {
    const actions = await this.getVaultActions();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const actionsToday = actions.filter(a => a.timestamp > oneDayAgo);

    return actionsToday.length < SYBIL_RESISTANCE.MAX_ACTIONS_PER_DAY;
  }

  /**
   * Check if account meets minimum requirements for reputation
   */
  static async meetsMinimumRequirements(): Promise<{
    meets: boolean;
    reasons: string[];
  }> {
    const accountAge = await this.getAccountAge();
    const participations = await this.getVaultParticipations();
    const uniqueVaults = new Set(participations.map(p => p.vaultId)).size;

    const reasons: string[] = [];

    if (accountAge < SYBIL_RESISTANCE.MIN_ACCOUNT_AGE_DAYS) {
      reasons.push(`Account must be at least ${SYBIL_RESISTANCE.MIN_ACCOUNT_AGE_DAYS} days old`);
    }

    if (uniqueVaults < SYBIL_RESISTANCE.MIN_UNIQUE_VAULTS) {
      reasons.push(`Must participate in at least ${SYBIL_RESISTANCE.MIN_UNIQUE_VAULTS} unique vaults`);
    }

    return {
      meets: reasons.length === 0,
      reasons,
    };
  }
}
