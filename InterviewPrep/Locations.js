import 'react-native-gesture-handler';
import React, {Component} from 'react';
import {StyleSheet, Text, View, Image} from 'react-native';
import colors from '../assets/colors';

class Locations extends Component {
  render() {
    return (
      <>
        <View style={styles.intro_container}>
          <View style={styles.header}>
            <Image
              style={styles.icon}
              source={require('../assets/health/map.png')}
            />
            <Text style={styles.title}>
              Review your location history{'\n'}from the last 14 days.
            </Text>
          </View>
          <Text style={styles.description}>
            Below are locations you’ve recently visited for 10 minutes or more.
          </Text>
        </View>
      </>
    );
  }
}

const styles = StyleSheet.create({
  intro_container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.card_border,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  icon: {
    width: 60,
    height: 70,
  },
  title: {
    paddingLeft: 10,
    fontSize: 18,
    lineHeight: 25,
    color: colors.section_title,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.module_title,
    paddingHorizontal: 20,
  },
  section_title: {
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    textTransform: 'uppercase',
    color: colors.secondary_body_copy,
    padding: 20,
    backgroundColor: colors.card_border,
  },
});

export default Locations;
