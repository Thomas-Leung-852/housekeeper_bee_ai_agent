import mqtt from 'mqtt';
import { promises as fs } from 'fs';

/********************************************
* Class: ZigbeeDeviceManager
*********************************************/
class ZigbeeDeviceManager {
	constructor(mqttBrokerUrl = 'mqtt://localhost:1883', baseTopic = 'zigbee2mqtt') {
		this.client = null;
		this.brokerUrl = mqttBrokerUrl;
		this.baseTopic = baseTopic;
		this.devices = new Map();
	}

	// Connect to MQTT broker
	async connect() {
		return new Promise((resolve, reject) => {
			this.client = mqtt.connect(this.brokerUrl);
			this.client.on('connect', () => {
				console.log('Connected to MQTT broker');
				this.subscribeToTopics();
				resolve();
			});

			this.client.on('error', (error) => {
				console.error('MQTT connection error:', error);
				reject(error);
			});
		});
	}

	// Subscribe to relevant Zigbee2MQTT topics
	subscribeToTopics() {
		// Subscribe to bridge info for device list
		this.client.subscribe(`${this.baseTopic}/bridge/devices`);
		this.client.subscribe(`${this.baseTopic}/bridge/info`);

		// Subscribe to all device messages
		this.client.subscribe(`${this.baseTopic}/+`);
		this.client.on('message', (topic, message) => {
			this.handleMessage(topic, message);
		});
	}

	// Handle incoming MQTT messages
	handleMessage(topic, message) {
		try {
			const messageStr = message.toString();

			// Handle bridge devices list
			if (topic === `${this.baseTopic}/bridge/devices`) {
				const devices = JSON.parse(messageStr);
				this.updateDevicesList(devices);
				return;
			}

			// Handle individual device messages
			if (topic.startsWith(`${this.baseTopic}/`) && !topic.includes('/bridge/')) {
				const deviceName = topic.replace(`${this.baseTopic}/`, '');

				// Skip coordinator and bridge messages
				if (deviceName === 'bridge' || deviceName.includes('bridge/')) return;

				try {
					const deviceData = JSON.parse(messageStr);
					this.updateDeviceStatus(deviceName, deviceData);
				} catch (e) {
					// Message might not be JSON (like availability messages)
					console.log(`Non-JSON message from ${deviceName}: ${messageStr}`);
				}
			}
		} catch (error) {
			console.error('Error handling message:', error);
		}
	}

	// Update devices list from bridge/devices message
	updateDevicesList(devices) {
		devices.forEach(device => {
			if (device.type !== 'Coordinator') {
				this.devices.set(device.friendly_name || device.ieee_address, {
					...device,
					lastSeen: new Date(),
					status: 'unknown'
				});
			}
		});

		console.log(`Updated devices list: ${this.devices.size} devices found`);
	}

	// Update individual device status
	updateDeviceStatus(deviceName, data) {
		if (this.devices.has(deviceName)) {
			const device = this.devices.get(deviceName);
			this.devices.set(deviceName, {
				...device,
				lastData: data,
				lastSeen: new Date(),
				status: 'online'
			});
		}
	}

	// Get all devices
	getDevices() {
		return Array.from(this.devices.values());
	}

	// Get devices by type
	getDevicesByType(type) {
		return this.getDevices().filter(device => 
			device.definition?.model?.toLowerCase().includes(type.toLowerCase()) ||
			device.model_id?.toLowerCase().includes(type.toLowerCase())
		);
	}

	// Get online devices
	getOnlineDevices() {
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
		return this.getDevices().filter(device => 
			device.lastSeen && device.lastSeen > fiveMinutesAgo
		);
	}

	// Request fresh device list from Zigbee2MQTT
	async requestDevicesList() {
		if (!this.client) {
			throw new Error('Not connected to MQTT broker');
		}

		return new Promise((resolve) => {
		// Request devices list
		this.client.publish(`${this.baseTopic}/bridge/request/devices`, '');

		// Wait a moment for the response
		setTimeout(() => {
			resolve(this.getDevices());
			}, 1000);
		});
	}

	// Export devices to JSON file
	async exportDevices(filename = 'zigbee_devices.json') {
		const devices = this.getDevices();
		const exportData = {
			timestamp: new Date().toISOString(),
			deviceCount: devices.length,
			devices: devices
		};

		await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
		console.log(`Exported ${devices.length} devices to ${filename}`);
		return exportData;
	}

	// Disconnect from MQTT
	disconnect() {
		if (this.client) {
			this.client.end();
			console.log('Disconnected from MQTT broker');
		}
	}
}


/*******************************************
* Class: ZigbeeDeviceAnalyst
********************************************/
class ZigbeeDeviceAnalyst {

	// Consturctor
	constructor(mqttBrokerUrl = 'mqtt://localhost:1883') {
		this.client = mqtt.connect(mqttBrokerUrl);
		this.setupEventHandlers();
	}

	// Setup Event Handler
	setupEventHandlers() {
		this.client.on('connect', () => { console.log('Connected to MQTT broker'); });
		this.client.on('error', (error) => { console.error('MQTT connection error:', error); });
	}

	// Get device state ad-hoc
	async getDeviceState(friendlyName, timeout = 5000) {
		return new Promise((resolve, reject) => {
			const stateTopic = `zigbee2mqtt/${friendlyName}`;
			const getTopic = `zigbee2mqtt/${friendlyName}/get`;

			// Subscribe to state topic to receive response
			this.client.subscribe(stateTopic, (err) => {
				if (err) {
					reject(new Error(`Failed to subscribe to ${stateTopic}: ${err.message}`));
					return;
				}
			});

			// Set up timeout
			const timeoutId = setTimeout(() => {
				this.client.unsubscribe(stateTopic);
				reject(new Error(`Timeout: No response from ${friendlyName} within ${timeout}ms`));
			}, timeout);

			// Listen for the state response
			const messageHandler = (topic, message) => {
				if (topic === stateTopic) {
					clearTimeout(timeoutId);
					this.client.unsubscribe(stateTopic);
					this.client.off('message', messageHandler);

					try {
						const state = JSON.parse(message.toString());
						resolve(state);
					} catch (parseError) {
						reject(new Error(`Failed to parse device state: ${parseError.message}`));
					}
				}
			};

			this.client.on('message', messageHandler);

			// Request the current state
			this.client.publish(getTopic, '{"state":""}', (err) => {
				if (err) {
				clearTimeout(timeoutId);
					this.client.unsubscribe(stateTopic);
					this.client.off('message', messageHandler);
					reject(new Error(`Failed to publish get request: ${err.message}`));
				}
			});
		});
	}

	// Get specific property
	async getDeviceProperty(friendlyName, property, timeout = 5000) {
		return new Promise((resolve, reject) => {
			const stateTopic = `zigbee2mqtt/${friendlyName}`;
			const getTopic = `zigbee2mqtt/${friendlyName}/get`;

			this.client.subscribe(stateTopic, (err) => {
				if (err) {
				  reject(new Error(`Failed to subscribe: ${err.message}`));
				  return;
				}
			});

			const timeoutId = setTimeout(() => {
				this.client.unsubscribe(stateTopic);
				reject(new Error(`Timeout: No response for ${property} from ${friendlyName}`));
			}, timeout);

			const messageHandler = (topic, message) => {
				if (topic === stateTopic) {
				  clearTimeout(timeoutId);
				  this.client.unsubscribe(stateTopic);
				  this.client.off('message', messageHandler);

				  try {
					const state = JSON.parse(message.toString());
					resolve(state[property] || null);
				  } catch (parseError) {
					reject(new Error(`Failed to parse response: ${parseError.message}`));
				  }
				}
			};

			this.client.on('message', messageHandler);

			// Request specific property
			const payload = JSON.stringify({ [property]: "" });

			this.client.publish(getTopic, payload, (err) => {
				if (err) {
				  clearTimeout(timeoutId);
				  reject(new Error(`Failed to request ${property}: ${err.message}`));
				}
			});
		});
	}

	async publishMsgToDevice(device_addr, msg){
		return	await this.client.publish(`zigbee2mqtt/${device_addr}/set`, msg, { retain: false }, (err) => {
				if (err) {
					return false; //`Failed to publish message: ${err} `
				} else {
					return true; //'Message published with retain flag set to true.'
				}
			});
	}

	disconnect() {
		this.client.end();
	}
} //class

export { ZigbeeDeviceManager, ZigbeeDeviceAnalyst };
