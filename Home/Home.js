import 'react-native-gesture-handler';
import React, {Component} from 'react';
import BackgroundFetch from 'react-native-background-fetch';
import LocationServices from '../Home/LocationServices';
import Notification from './Notification';
import Toggle from '../views/Toggle';
import colors from '../assets/colors';
import {
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  Linking,
} from 'react-native';
import {GET_MESSAGE_LIST_URL, FETCH_MESSAGE_INFO_URL} from '../utils/endpoints';
import {DEFAULT_NOTIFICATION} from '../utils/constants';
import {GetStoreData, SetStoreData} from '../utils/asyncStorage';
import {getLatestCoarseLocation} from '../utils/coarseLocation';
import Ble from '../utils/ble';
import SymptomTracker from '../SymptomTracker/SymptomTracker';
import SettingsModal from '../Settings/SettingsModal';
import ResourcesComponent from '../ResourcesComponent/ResourcesComponent';
import {UW_URL} from '../utils/constants';
import Privacy from '../Privacy/Privacy';

class Home extends Component {
  constructor() {
    super();

    this.state = {
      refreshing: false,
      location: false,
      ble: false,
      notifications: [],
    };
  }

  componentDidMount() {
    this.processQueries();
    BackgroundFetch.configure(
      {minimumFetchInterval: 15}, // <-- minutes (15 is minimum allowed)
      async taskId => {
        console.log('[js] Received background-fetch event: ', taskId);
        this.processQueries();
        BackgroundFetch.finish(taskId);
      },
      error => {
        console.log('[js] RNBackgroundFetch failed to start');
        console.log(error);
      },
    );

    // Optional: Query the authorization status.
    BackgroundFetch.status(status => {
      switch (status) {
        case BackgroundFetch.STATUS_RESTRICTED:
          console.log('BackgroundFetch restricted');
          break;
        case BackgroundFetch.STATUS_DENIED:
          console.log('BackgroundFetch denied');
          break;
        case BackgroundFetch.STATUS_AVAILABLE:
          console.log('BackgroundFetch is enabled');
          break;
      }
    });

    this.getSetting('ENABLE_LOCATION').then(data => {
      this.setState({
        location: data,
      });
    });

    this.getSetting('ENABLE_BLE').then(data => {
      this.setState({
        ble: data,
      });
    });

    this.getNotifications().then(data => {
      if (data) {
        this.setState({
          notifications: data,
        });
      }
    });
  }

  getSetting = key => {
    return GetStoreData(key).then(data => {
      return data === 'true' ? true : false;
    });
  };

  getNotifications = () => {
    return GetStoreData('NOTIFICATIONS').then(data => {
      if (data) {
        return JSON.parse(data);
      }
      return;
    });
  };

  processQueries = async () => {
    let location = await getLatestCoarseLocation();
    const messageIDs = await this.fetchMessageID(location);
    if (messageIDs && messageIDs.length > 0) {
      const messages = await this.fetchMessages(messageIDs);
      let args = [];
      let msgs = [];
      messages.forEach(messageObj => {
        const {bluetoothMatches} = messageObj;

        bluetoothMatches.forEach(match => {
          const {userMessage, seeds} = match;
          let timestamps = [];
          let seedsArray = [];
          seeds.forEach(seedObj => {
            if (seedObj
              && seedObj.seed
              && seedObj.seed !== '00000000-0000-0000-0000-000000000000') {
              timestamps.push(seedObj.sequenceStartTime);
              seedsArray.push(seedObj.seed);
            }
          });

          if (seedsArray && seedsArray.length > 0) {
            args.push(seedsArray);
            args.push(timestamps);

            if (userMessage) {
              msgs.push(userMessage);
            } else {
              msgs.push(DEFAULT_NOTIFICATION);
            }
          }
        });
      });

      let notifications = await this.searchQuery(args, msgs);
      if (notifications && notifications.length > 0) {
        SetStoreData('NOTIFICATIONS', notifications);
      }
    }
  };

  searchQuery = async (args, msgs) => {
    console.log("===args===");
    console.log(args);
    console.log("===msgs===");
    console.log(msgs);

    return Ble.runBleQuery(args).then(
      results => {
        console.log("==results===")
        console.log(results);
        let notifications = [];
        results.forEach((result, index) => {
          if (result === 1) {
            const msg = msgs[index];
            notifications.push(msg);
          }
        });
        return notifications;
      },
      error => {
        console.log(error);
      },
    );
  };

  fetchMessageID = location => {
    const url = `${GET_MESSAGE_LIST_URL}?lat=${location.latitudePrefix}&lon=${location.longitudePrefix}&precision=${location.precision}&lastTimestamp=0`;

    return fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    })
      .then(response => {
        return response.json();
      })
      .then(data => {
        const {messageInfoes} = data;
        return messageInfoes;
      })
      .catch(err => {
        console.error(err);
      });
  };

  fetchMessages = messageIDs => {
    return fetch(FETCH_MESSAGE_INFO_URL, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        "RequestedQueries": messageIDs
      }),
    })
      .then(response => {
        return response.json();
      })
      .then(data => {
        return data;
      })
      .catch(err => {
        console.error(err);
      });
  };

  updateSetting = state => {
    if (state) {
      SetStoreData('ENABLE_LOCATION', 'true');
      SetStoreData('ENABLE_BLE', 'true');

      this.setState({
        location: true,
        ble: true,
      });

      LocationServices.start();
      Ble.start();
    } else {
      SetStoreData('ENABLE_LOCATION', 'false');
      SetStoreData('ENABLE_BLE', 'false');

      this.setState({
        location: false,
        ble: false,
      });
      LocationServices.stop();
      Ble.stop();
    }
  };

  handleOnRefresh = () => {
    // this.setState({
    //   refreshing: true,
    // });
    // this.processQueries().then(() => this.setState({refreshing: false}));
  };

  render() {
    const {location, ble} = this.state;
    const isBroadcasting = location || ble;
    const broadcastStatus = isBroadcasting ? 'On' : 'Off';
    const broadcastBg = isBroadcasting
      ? styles.broadcast_on
      : styles.broadcast_off;

    return (
      <>
        <SafeAreaView style={styles.status_bar} />
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={this.handleOnRefresh}
            />
          }
        >
          <View style={styles.status_container}>
            <View style={styles.status_header}>
              <View style={styles.title_container}>
                <Image
                  style={styles.logo}
                  source={require('../assets/home/logo.png')}
                />
                <Text style={styles.title}>CovidSafe</Text>
              </View>
              <SettingsModal />
            </View>
            <View style={[styles.broadcast_container, broadcastBg]}>
              <View style={styles.broadcast}>
                <View style={styles.broadcast_content}>
                  <Text style={styles.broadcast_title}>
                    {`Broadcasting ${broadcastStatus}`}
                  </Text>
                  <Text style={styles.broadcast_description}>
                    {isBroadcasting
                      ? 'Turn broadcasting on to\nimprove the accuracy of your\nnotifications. '
                      : 'Limited trace data is being\ncollected. We keep your identity\nanonymous. '
                    }
                    <Text
                      style={styles.lear_more_link}
                      onPress={() => Linking.openURL(UW_URL)}>
                      Learn More
                    </Text>
                  </Text>
                </View>
              </View>
              <View>
                <Toggle
                  handleToggle={selectedState => {
                    this.updateSetting(selectedState);
                  }}
                  value={this.state.location || this.state.ble}
                />
              </View>
            </View>
          </View>

          {this.state.notifications && this.state.notifications.length > 0 && (
            <Notification notifications={this.state.notifications} />
          )}

          <SymptomTracker
            navigate={this.props.navigation.navigate}
            date={new Date()}
          />

          <ResourcesComponent />
          <Privacy />
        </ScrollView>
      </>
    );
  }
}

const styles = StyleSheet.create({
  status_bar: {
    backgroundColor: 'white',
  },
  status_container: {
    backgroundColor: 'white',
    padding: 10,
  },
  logo: {
    width: 30,
    height: 30,
    marginRight: 5,
  },
  title: {
    color: colors.section_title,
    fontSize: 24,
    fontWeight: '500',
  },
  title_container: {
    flexDirection: 'row',
  },
  status_header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    alignItems: 'center',
  },
  broadcast_container: {
    marginVertical: 10,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  broadcast_on: {
    backgroundColor: colors.fill_on,
  },
  broadcast_off: {
    backgroundColor: colors.fill_off,
  },
  broadcast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  broadcast_title: {
    color: colors.module_title,
    fontWeight: '600',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.35,
    paddingBottom: 10,
  },
  broadcast_description: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.24,
    color: colors.secondary_body_copy,
  },
  lear_more_link: {
    color: colors.primary_theme,
  },
  resources_container: {
    backgroundColor: 'white',
    height: '100%',
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 20,
    marginHorizontal: 10,
  },
  resources_header: {
    fontWeight: '600',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.35,
    color: colors.module_title,
  },
  resource: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: '600',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.408,
    color: colors.module_title,
  },
  resource_logo: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  resource_title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.408,
    color: colors.module_title,
  },
  resource_description: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.24,
    color: colors.secondary_body_copy,
  },
});

export default Home;
