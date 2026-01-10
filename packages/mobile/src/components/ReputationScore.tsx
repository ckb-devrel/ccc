import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {MaterialCommunityIcons as Icon} from '@expo/vector-icons';
import {ReputationScore as ReputationScoreType} from '../types/reputation';

interface ReputationScoreProps {
  score: ReputationScoreType;
  showDetails?: boolean;
}

const ReputationScoreComponent: React.FC<ReputationScoreProps> = ({
  score,
  showDetails = false,
}) => {
  const getScoreColor = (value: number): string => {
    if (value >= 850) return '#34C759'; // Green
    if (value >= 700) return '#007AFF'; // Blue
    if (value >= 500) return '#FF9500'; // Orange
    return '#FF3B30'; // Red
  };

  const getScoreLabel = (value: number): string => {
    if (value >= 900) return 'Exemplary';
    if (value >= 800) return 'Excellent';
    if (value >= 700) return 'Very Good';
    if (value >= 600) return 'Good';
    if (value >= 500) return 'Fair';
    return 'Building';
  };

  const scoreColor = getScoreColor(score.overallScore);
  const scoreLabel = getScoreLabel(score.overallScore);

  return (
    <View style={styles.container}>
      {/* Overall Score */}
      <View style={styles.scoreCircle}>
        <View
          style={[
            styles.scoreCircleInner,
            {borderColor: scoreColor},
          ]}>
          <Text style={[styles.scoreValue, {color: scoreColor}]}>
            {score.overallScore}
          </Text>
          <Text style={styles.scoreMax}>/1000</Text>
        </View>
      </View>

      <View style={styles.scoreInfo}>
        <Text style={styles.scoreLabel}>{scoreLabel}</Text>
        <Text style={styles.scoreSubtext}>
          Based on {score.totalActions}+ vault actions
        </Text>
      </View>

      {/* Component Scores */}
      {showDetails && (
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Icon name="clock-check" size={20} color="#666" />
            <Text style={styles.detailLabel}>Reliability</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${score.reliabilityScore * 100}%`,
                    backgroundColor: scoreColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.detailValue}>
              {Math.round(score.reliabilityScore * 100)}%
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="handshake" size={20} color="#666" />
            <Text style={styles.detailLabel}>Cooperation</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${score.cooperationScore * 100}%`,
                    backgroundColor: scoreColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.detailValue}>
              {Math.round(score.cooperationScore * 100)}%
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="checkbox-marked-circle" size={20} color="#666" />
            <Text style={styles.detailLabel}>Consistency</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${score.consistencyScore * 100}%`,
                    backgroundColor: scoreColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.detailValue}>
              {Math.round(score.consistencyScore * 100)}%
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  scoreCircle: {
    marginBottom: 16,
  },
  scoreCircleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9F9F9',
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  scoreMax: {
    fontSize: 14,
    color: '#999',
  },
  scoreInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  scoreSubtext: {
    fontSize: 14,
    color: '#666',
  },
  detailsContainer: {
    width: '100%',
    marginTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    width: 100,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
});

export default ReputationScoreComponent;
