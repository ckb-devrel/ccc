import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {MaterialCommunityIcons as Icon} from '@expo/vector-icons';
import {ReputationBadge} from '../types/reputation';

interface BadgeDisplayProps {
  badge: ReputationBadge;
  size?: 'small' | 'medium' | 'large';
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({
  badge,
  size = 'medium',
}) => {
  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'platinum':
        return '#E5E4E2';
      case 'gold':
        return '#FFD700';
      case 'silver':
        return '#C0C0C0';
      case 'bronze':
        return '#CD7F32';
      default:
        return '#999';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          iconSize: 24,
          nameSize: styles.smallName,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          iconSize: 48,
          nameSize: styles.largeName,
        };
      default:
        return {
          container: styles.mediumContainer,
          iconSize: 32,
          nameSize: styles.mediumName,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const tierColor = getTierColor(badge.tier);

  return (
    <View style={[styles.container, sizeStyles.container]}>
      <View style={[styles.badge, {backgroundColor: tierColor}]}>
        <Icon
          name={badge.icon as any}
          size={sizeStyles.iconSize}
          color="#FFF"
        />
      </View>
      <Text style={[styles.name, sizeStyles.nameSize]}>{badge.name}</Text>
      {size === 'large' && (
        <Text style={styles.description}>{badge.description}</Text>
      )}
      {badge.earnedAt && (
        <Text style={styles.earnedDate}>
          Earned {new Date(badge.earnedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 12,
  },
  smallContainer: {
    width: 80,
  },
  mediumContainer: {
    width: 120,
  },
  largeContainer: {
    width: '100%',
  },
  badge: {
    borderRadius: 40,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  name: {
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  smallName: {
    fontSize: 10,
  },
  mediumName: {
    fontSize: 12,
  },
  largeName: {
    fontSize: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  earnedDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default BadgeDisplay;
