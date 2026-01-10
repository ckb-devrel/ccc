# Privacy-Preserving Reputation System

## Overview

The CCC Mobile Wallet includes a sophisticated, privacy-preserving reputation system that tracks user reliability in shared vault operations without compromising anonymity or enabling harassment.

## Key Features

### 🔒 Privacy-First Design

- **Opt-in Disclosure**: Reputation scores are private by default
- **Zero-Knowledge Proofs**: Prove claims without revealing exact data
- **Fuzzy Counts**: Action counts are bucketed to prevent precise tracking
- **Pedersen Commitments**: Cryptographic commitments hide actual values

### 🛡️ Sybil Resistance

Multiple layers prevent gaming the system:

1. **Account Age Requirements**: Minimum 7-day age before earning reputation
2. **Unique Vault Requirements**: Must participate in ≥3 unique vaults
3. **Rate Limiting**: Maximum 5 actions per day
4. **Velocity Detection**: Flags accounts with >80% actions in short bursts

### 🌟 Non-Transferable & Non-Financial

- Reputation is bound to your identity
- Cannot be bought, sold, or transferred
- No financial value or tradability
- Based purely on behavioral history

### ❤️ Positive-Only Signals

- No public shaming or negative score broadcasting
- Low scores remain private
- Only positive achievements are shareable
- Focus on reliability, not punishment

## How It Works

### Score Components

Your reputation is calculated from four components:

**1. Reliability Score** (0-100%)
- Measures time lock adherence
- Honoring commitments vs violations
- Weighted by temporal decay (recent > old)

**2. Cooperation Score** (0-100%)
- Peaceful vault exits
- Cooperative dispute resolution
- Avoiding forced liquidations

**3. Consistency Score** (0-100%)
- Vault completion rate
- Abandoned vaults impact negatively
- Long-term participation patterns

**4. Overall Score** (0-1000)
- Weighted combination of all components
- Normalized to 0-1000 range
- Privacy-preserving bucketed display

### Behavioral Tracking

Actions that affect your reputation:

| Behavior | Impact | Weight |
|----------|--------|--------|
| ✅ Time Lock Honored | Positive | +10 |
| 🤝 Cooperative Exit | Positive | +15 |
| ⚖️ Dispute Resolved | Positive | +12 |
| 🚫 Vault Abandoned | Negative | -20 |
| ⏰ Early Exit Penalty | Negative | -8 |

### Temporal Decay

Recent actions matter more than old ones:

- **Half-life**: 180 days by default (configurable)
- **Formula**: `weight = e^(-age_days / half_life)`
- **Example**: 6-month-old action has ~50% weight of today's action
- **Opt-out**: Can disable decay in settings

## Privacy Features

### 1. Fuzzy Counting

Exact counts are never revealed. Instead, values are bucketed:

**Action Buckets**: 0, 5, 10, 25, 50, 100, 250, 500+
**Age Buckets**: 0, 7, 30, 90, 180, 365+ days

Example: "100+ actions" instead of "137 actions"

### 2. Zero-Knowledge Attestations

Prove claims about your score without revealing it:

```typescript
// Generate proof that score > 700 without revealing exact score
const attestation = await ReputationService.generateAttestation(
  'min_score',
  700
);

// Others can verify this proof
const isValid = await ReputationService.verifyAttestation(attestation);
```

**Attestation Types**:
- `min_score`: Prove score ≥ threshold
- `behavior_count`: Prove ≥ N positive actions
- `no_negative`: Prove no negative actions in period

### 3. Pedersen Commitments

Scores are committed using cryptographic commitments:

```
commitment = Hash(score || randomness)
```

You can prove properties of the committed value without revealing it.

### 4. Merkle Tree Proofs

Individual vault actions are stored in a Merkle tree:

- Root hash published (if opting in)
- Prove specific action without revealing others
- Efficient verification with log(n) proof size

## Sybil Resistance

### Minimum Requirements

To participate in reputation system:

```typescript
{
  minimumAccountAge: 7 days,
  minimumUniqueVaults: 3,
  maximumActionsPerDay: 5
}
```

### Detection Mechanisms

**1. Velocity Analysis**
- Tracks action clustering
- Flags suspicious rapid-fire patterns
- Requires natural time distribution

**2. Vault Diversity**
- Must interact with multiple unique vaults
- Prevents self-dealing loops
- Encourages genuine participation

**3. Temporal Consistency**
- Account age verification
- Gradual reputation building
- No instant high scores

**4. Rate Limiting**
- Max 5 reputation-earning actions/day
- Prevents farming through automation
- Encourages quality over quantity

## Achievements & Badges

### Badge Tiers

Earn badges for sustained good behavior:

#### 🥉 Bronze: Reliable Newcomer
- Score ≥ 600
- 5+ actions
- 7+ day account age

#### 🥈 Silver: Trusted Participant
- Score ≥ 750
- 25+ actions
- 30+ day account age

#### 🥇 Gold: Vault Veteran
- Score ≥ 850
- 100+ actions
- 90+ day account age

#### 💎 Platinum: Exemplary Guardian
- Score ≥ 950
- 250+ actions
- 180+ day account age

### Badge Properties

- **Non-transferable**: Tied to your account
- **Revocable**: Can be lost if score drops
- **Private by default**: Share only if you choose
- **Provable**: ZK proofs available for achievements

## Privacy Settings

### Control Your Data

```typescript
interface ReputationSettings {
  shareScore: boolean;           // Allow others to see score
  shareAttestations: boolean;    // Enable attestation generation
  includeBehaviors: VaultBehaviorType[];  // Which actions to count
  decayEnabled: boolean;         // Apply temporal decay
  decayHalfLife: number;        // Decay rate (days)
}
```

### Granular Sharing

Choose exactly what to share:

1. **Nothing** (default): Completely private
2. **Badge Only**: Show achievements, not score
3. **Range Proof**: Prove score in range without exact value
4. **Full Score**: Share exact score (opt-in only)

## API Reference

### Recording Actions

```typescript
// Record a vault action
await ReputationService.recordVaultAction(
  vaultId,
  VaultBehaviorType.TIME_LOCK_HONORED,
  { /* encrypted details */ }
);

// Record vault participation
await ReputationService.recordVaultParticipation({
  vaultId: '0x...',
  role: 'participant',
  joinedAt: Date.now(),
  status: 'active'
});
```

### Checking Score

```typescript
// Get current score
const score = await ReputationService.getReputationScore();

// Calculate fresh score
const newScore = await ReputationService.calculateReputationScore();

// Update score
await ReputationService.updateReputationScore();
```

### Generating Proofs

```typescript
// Minimum score attestation
const minScoreProof = await ReputationService.generateAttestation(
  'min_score',
  700
);

// Behavior count attestation
const actionProof = await ReputationService.generateAttestation(
  'behavior_count',
  50
);

// Verify attestation
const isValid = await ReputationService.verifyAttestation(attestation);
```

### Managing Settings

```typescript
// Get settings
const settings = await ReputationService.getSettings();

// Update settings
await ReputationService.updateSettings({
  shareScore: true,
  decayEnabled: false
});
```

### Badges

```typescript
// Get earned badges
const earned = await ReputationService.getEarnedBadges();

// Get all available badges
const all = await ReputationService.getAvailableBadges();
```

## Security Considerations

### What's Protected

✅ Exact score values (with fuzzy display)
✅ Exact action counts
✅ Vault participation details
✅ Timestamp precision
✅ Behavioral patterns

### What's NOT Protected

⚠️ That you have a reputation account
⚠️ Approximate score range (if you share)
⚠️ Badge achievements (if displayed)
⚠️ Opt-in shared attestations

### Threat Model

**Protects Against**:
- Precise tracking of user activity
- Correlation across multiple vaults (with buckets)
- Sybil attacks through farming
- Public shaming via low scores
- Reputation marketplaces

**Does NOT Protect Against**:
- Determined attackers with vast resources
- Side-channel attacks on device
- Social engineering
- Legal compulsion to reveal data

## Best Practices

### For Users

1. **Keep it Private**: Don't share unless necessary
2. **Enable Decay**: Allows recovery from past mistakes
3. **Quality > Quantity**: Focus on genuine participation
4. **Protect Your Device**: Reputation tied to secure keystore

### For Vault Creators

1. **Don't Require Scores**: Reputation is opt-in
2. **Accept Range Proofs**: Don't demand exact values
3. **Set Reasonable Minimums**: Don't exclude newcomers
4. **Combine with Other Signals**: Don't rely solely on reputation

### For Developers

1. **Never Log Scores**: Privacy-preserving by default
2. **Use Attestations**: Leverage ZK proofs for verification
3. **Respect Opt-out**: Honor privacy settings
4. **Audit Regularly**: Check for privacy leaks

## Future Enhancements

### Roadmap

- [ ] On-chain attestation registry
- [ ] Cross-chain reputation portability
- [ ] ML-based anomaly detection
- [ ] Recursive proof composition
- [ ] Reputation delegation (limited)
- [ ] Anonymous credential system
- [ ] Homomorphic encryption for calculations
- [ ] Multi-party computation for aggregation

## References

- **Pedersen Commitments**: Hiding values cryptographically
- **Fiat-Shamir Heuristic**: Non-interactive ZK proofs
- **Merkle Trees**: Efficient membership proofs
- **Temporal Decay**: Exponential forgetting curves
- **Fuzzy Privacy**: Differential privacy via bucketing

## FAQ

**Q: Can I reset my reputation?**
A: No, but temporal decay means old actions matter less over time.

**Q: What if I'm falsely accused?**
A: Reputation is based on on-chain actions, not accusations. Disputes have resolution mechanisms.

**Q: Can I transfer reputation to another account?**
A: No. Reputation is non-transferable by design.

**Q: How is this different from credit scores?**
A: Privacy-first, opt-in, non-financial, and focused on reliability not creditworthiness.

**Q: What prevents someone from creating many accounts?**
A: Account age, unique vault requirements, and velocity detection make farming impractical.

**Q: Can vaults require minimum reputation?**
A: No. Reputation is for user benefit, not gatekeeping. Vaults can request proofs but can't mandate them.

---

**Remember**: Reputation is a tool for building trust, not a requirement for participation. Use it responsibly and respect others' privacy choices.
