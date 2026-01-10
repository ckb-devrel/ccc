import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import {MaterialCommunityIcons as Icon} from '@expo/vector-icons';
import {ReputationService} from '../services/reputation';
import {
  ReputationScore as ReputationScoreType,
  ReputationSettings,
  ReputationBadge,
  VaultBehaviorType,
} from '../types/reputation';
import ReputationScoreComponent from '../components/ReputationScore';
import BadgeDisplay from '../components/BadgeDisplay';

const ReputationScreen = () => {
  const [score, setScore] = useState<ReputationScoreType | null>(null);
  const [settings, setSettings] = useState<ReputationSettings | null>(null);
  const [badges, setBadges] = useState<ReputationBadge[]>([]);
  const [availableBadges, setAvailableBadges] = useState<ReputationBadge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requirements, setRequirements] = useState<{
    meets: boolean;
    reasons: string[];
  } | null>(null);

  useEffect(() => {
    loadData();
    checkRequirements();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [scoreData, settingsData, earnedBadges, allBadges] =
        await Promise.all([
          ReputationService.getReputationScore(),
          ReputationService.getSettings(),
          ReputationService.getEarnedBadges(),
          ReputationService.getAvailableBadges(),
        ]);

      setScore(scoreData);
      setSettings(settingsData);
      setBadges(earnedBadges);
      setAvailableBadges(allBadges);
    } catch (error) {
      Alert.alert('Error', 'Failed to load reputation data');
    } finally {
      setIsLoading(false);
    }
  };

  const checkRequirements = async () => {
    const reqs = await ReputationService.meetsMinimumRequirements();
    setRequirements(reqs);
  };

  const handleRefresh = async () => {
    await ReputationService.updateReputationScore();
    await loadData();
  };

  const toggleShareScore = async (value: boolean) => {
    try {
      await ReputationService.updateSettings({shareScore: value});
      setSettings(prev => (prev ? {...prev, shareScore: value} : null));
    } catch (error) {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const toggleDecay = async (value: boolean) => {
    try {
      await ReputationService.updateSettings({decayEnabled: value});
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const generateAttestation = async () => {
    if (!score) return;

    try {
      const attestation = await ReputationService.generateAttestation(
        'min_score',
        700,
      );

      Alert.alert(
        'Attestation Generated',
        `You can now prove your score is above 700 without revealing the exact value.\n\nExpires: ${new Date(attestation.expiresAt).toLocaleDateString()}`,
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to generate attestation');
    }
  };

  if (!score || !settings) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="medal" size={64} color="#CCC" />
        <Text style={styles.emptyText}>Building your reputation...</Text>
        <Text style={styles.emptySubtext}>
          Participate in vaults to earn reputation
        </Text>
      </View>
    );
  }

  const unearnedBadges = availableBadges.filter(
    b => !badges.some(earned => earned.id === b.id),
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
      }>
      {/* Requirements Warning */}
      {requirements && !requirements.meets && (
        <View style={styles.warningCard}>
          <Icon name="information" size={24} color="#FF9500" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>
              Reputation Not Yet Active
            </Text>
            {requirements.reasons.map((reason, index) => (
              <Text key={index} style={styles.warningText}>
                • {reason}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Score Display */}
      <View style={styles.card}>
        <ReputationScoreComponent score={score} showDetails />
      </View>

      {/* Privacy Notice */}
      <View style={styles.privacyNotice}>
        <Icon name="shield-lock" size={20} color="#007AFF" />
        <Text style={styles.privacyText}>
          Your reputation data is private by default. Enable sharing to allow
          others to verify your reliability.
        </Text>
      </View>

      {/* Earned Badges */}
      {badges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Icon name="trophy" size={20} color="#FFD700" /> Achievements
          </Text>
          <View style={styles.badgesGrid}>
            {badges.map(badge => (
              <BadgeDisplay key={badge.id} badge={badge} size="medium" />
            ))}
          </View>
        </View>
      )}

      {/* Available Badges */}
      {unearnedBadges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Badges</Text>
          <View style={styles.badgesGrid}>
            {unearnedBadges.map(badge => (
              <View key={badge.id} style={styles.lockedBadge}>
                <BadgeDisplay badge={badge} size="small" />
                <View style={styles.lockOverlay}>
                  <Icon name="lock" size={24} color="#999" />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Privacy Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy Settings</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Icon name="eye" size={24} color="#007AFF" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Share Score</Text>
              <Text style={styles.settingSubtext}>
                Allow others to see your reputation score
              </Text>
            </View>
          </View>
          <Switch
            value={settings.shareScore}
            onValueChange={toggleShareScore}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Icon name="clock-outline" size={24} color="#007AFF" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Time Decay</Text>
              <Text style={styles.settingSubtext}>
                Recent actions weighted higher
              </Text>
            </View>
          </View>
          <Switch value={settings.decayEnabled} onValueChange={toggleDecay} />
        </View>
      </View>

      {/* Generate Attestation */}
      {settings.shareScore && score.overallScore >= 700 && (
        <TouchableOpacity
          style={styles.attestationButton}
          onPress={generateAttestation}>
          <Icon name="certificate" size={24} color="#FFF" />
          <Text style={styles.attestationButtonText}>
            Generate Privacy-Preserving Attestation
          </Text>
        </TouchableOpacity>
      )}

      {/* How It Works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How Reputation Works</Text>

        <View style={styles.infoCard}>
          <Icon name="shield-check" size={24} color="#34C759" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Privacy-Preserving</Text>
            <Text style={styles.infoSubtext}>
              Your exact score and vault activities remain private. Share only
              what you choose.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Icon name="account-lock" size={24} color="#007AFF" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Non-Transferable</Text>
            <Text style={styles.infoSubtext}>
              Reputation is tied to your account and cannot be bought, sold, or
              transferred.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Icon name="shield-alert" size={24} color="#FF9500" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Sybil-Resistant</Text>
            <Text style={styles.infoSubtext}>
              Multiple safeguards prevent gaming the system through fake
              accounts or rapid actions.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Icon name="heart-circle" size={24} color="#FF3B30" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Positive-Only Signals</Text>
            <Text style={styles.infoSubtext}>
              No public shaming. Low scores are not broadcast - only positive
              achievements are shared.
            </Text>
          </View>
        </View>
      </View>

      {/* Score Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Score Components</Text>
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownText}>
            • <Text style={styles.breakdownBold}>Reliability:</Text> Honoring
            time locks and commitments
          </Text>
          <Text style={styles.breakdownText}>
            • <Text style={styles.breakdownBold}>Cooperation:</Text> Peaceful
            vault exits and dispute resolution
          </Text>
          <Text style={styles.breakdownText}>
            • <Text style={styles.breakdownBold}>Consistency:</Text> Completing
            vaults vs abandoning them
          </Text>
          <Text style={styles.breakdownText}>
            • <Text style={styles.breakdownBold}>Temporal Weight:</Text> Recent
            behavior matters more (if enabled)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  privacyNotice: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    margin: 16,
    marginTop: 0,
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  privacyText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#0D47A1',
    lineHeight: 18,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  lockedBadge: {
    position: 'relative',
    opacity: 0.5,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  settingSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  attestationButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  attestationButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 12,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  breakdownCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
  },
  breakdownText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  breakdownBold: {
    fontWeight: 'bold',
    color: '#000',
  },
});

export default ReputationScreen;
