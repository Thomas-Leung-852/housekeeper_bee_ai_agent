import mqtt from 'mqtt';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import HousekeeperBeeAiTools from './lib/housekeeper-bee-ai-tools.js'

// If some packages don't support ES6 imports
const { default: TelegramBot } = await import('node-telegram-bot-api');


/************************************************************************************************************************
*  class: MQTTTemperatureAlertSystem
************************************************************************************************************************/
class MQTTTemperatureAlertSystem {

	/*=============================================================
	* Function: constructor
	* @param {Object} config - configuration
	* @param {number} temperatureThrehold - Temperature Threshold
	* @param {number} humidityThrehold - Humidity Threshold
	* @param {number} coolDownTime - alert send interval
	===============================================================*/
	constructor(config = {},
		temperatureThreshold = 30.0,
		humidityThreshold = 97.0,
		coolDownTime = 30
		) {
		this.mqttConfig = {
		    host: config.mqtt.host,
		    port: config.mqtt.port,
		    username: config.mqtt.username,
		    password: config.mqtt.password,
		    ...config.mqtt
		};

		this.ollamaConfig = {
		    url: config.ollama.url,
		    model: config.ollama.eng_model,
		    ...config.ollama
		};

		// Telegram configuration
		this.telegramConfig = {
		    botToken: config.telegram?.botToken || '',
		    chatIds: config.telegram?.chatIds || [], // Array of chat IDs for owner and family
		    ...config.telegram
		};

		this.lastAlertTime = new Map(); // Track last alert time per device to prevent spam

		// Critical threshold
		this.criticalTemperature = temperatureThreshold;
		this.criticalHumidity = humidityThreshold;

		this.alertCooldownMinutes = coolDownTime; // Minimum time between alerts for same device

		// Temperature thresholds based on your definition
		this.temperatureRanges = [
		    { start: 0, end: 10, description: "Cool", alertLevel: "info" },
		    { start: 10, end: 20, description: "Good", alertLevel: "normal" },
		    { start: 20, end: 30, description: "Hot", alertLevel: "warning" },
		    { start: 30, end: 36, description: "Very hot", alertLevel: "high" },
		    { start: 36, end: null, description: "Extremely hot", alertLevel: "critical" }
		];

		this.mqttClient = null;
	}

	/*=====================================================
	* Function: initial
	=======================================================*/
	async init() {
		await this.connectToMQTT();
		console.log('🚀 System initialized successfully!');
	}

	/*=====================================================
	* Function: Connect to MQTT broker
	=======================================================*/
	async connectToMQTT() {
		const clientOptions = {
		    host: this.mqttConfig.host,
		    port: this.mqttConfig.port,
		    clean: true,
		    connectTimeout: 4000,
		};

		if (this.mqttConfig.username) {
		    clientOptions.username = this.mqttConfig.username;
		    clientOptions.password = this.mqttConfig.password;
		}

		try {
		    console.log(`🔗 Connecting to MQTT broker at ${this.mqttConfig.host}:${this.mqttConfig.port}`);
		    this.mqttClient = mqtt.connect(clientOptions);

		    this.mqttClient.on('connect', () => {
		        console.log('✅ Connected to MQTT broker');
		        this.subscribeToTopics();
		    });

		    this.mqttClient.on('message', (topic, message) => {
		        this.handleMQTTMessage(topic, message);
		    });

		    this.mqttClient.on('error', (error) => {
		        console.error('❌ MQTT connection error:', error.message);
		    });

		    this.mqttClient.on('close', () => {
		        console.log('🔌 MQTT connection closed');
		    });

		} catch (error) {
		    console.error('❌ Failed to connect to MQTT broker:', error.message);
		    throw error;
		}
	}

	/*=====================================================
	* Function: Subscribe MQ topic
	=======================================================*/
	subscribeToTopics() {
		const topics = [
		    'zigbee2mqtt/+',
		];

		topics.forEach(topic => {
		    this.mqttClient.subscribe(topic, (err) => {
		        if (err) {
		            console.error(`❌ Failed to subscribe to ${topic}:`, err.message);
		        } else {
		            console.log(`📡 Subscribed to: ${topic}`);
		        }
		    });
		});
	}

	/*=====================================================
	* Function: MQTT Message handler
	=======================================================*/
	async handleMQTTMessage(topic, message) {

		// Auto-restart if Ollama unhealthy
		if (!(await this.checkOllamaHealth())) {
		    console.log('Ollama unhealthy, restarting...');
		    exec('docker container restart ollama');
		    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
		}

		try {
		    const messageStr = message.toString();
		    let payload;

		    try {
		        payload = JSON.parse(messageStr);
		    } catch {
		        const tempValue = parseFloat(messageStr);
		        if (!isNaN(tempValue)) {
		            payload = { temperature: tempValue };
		        } else {
		            return;
		        }
		    }

		    const deviceInfo = this.extractDeviceInfo(topic, payload);
		    if (deviceInfo && (deviceInfo.temperature !== null || deviceInfo.humidity !== null) ) {
			await this.processTemperatureReading(deviceInfo);
		    }

		} catch (error) {
		    console.error('❌ Error handling MQTT message:', error.message);
		}
	}

	/*=====================================================
	* Function: Extract Device Info
	=======================================================*/
	extractDeviceInfo(topic, payload) {
		const timestamp = new Date().toISOString();
		let deviceId, location, temperature, humidity;

		temperature = payload.temperature || payload.temp || payload.value || null;
		humidity = payload.humidity || payload.value || null;

		if ( (temperature === null || isNaN(temperature)) && (humidity === null || isNaN(humidity)) ) {
		    return null;
		}

		const topicParts = topic.split('/');

		if (topic.startsWith('zigbee2mqtt/')) {
		    deviceId = topicParts[1];
		    location = payload.location || deviceId;
		}else {
		    deviceId = topicParts[topicParts.length - 2] || 'unknown';
		    location = payload.location || 'unknown';
		}

		return {
			deviceId,
			location,
			temperature: parseFloat(temperature) * 1.0,
			humidity: parseFloat(humidity) * 1.0,
			timestamp,
			topic,
			battery: payload.battery || null,
			linkquality: payload.linkquality || null
		};
	}


	/*=====================================================
	* Function: Get Status
	=======================================================*/
	getTemperatureStatus(temperature) {
		for (const range of this.temperatureRanges) {
		    if (temperature >= range.start && (range.end === null || temperature <= range.end)) {
		        return range;
		    }
		}

		return { description: "Unknown", alertLevel: "info" };
	}

	/*=====================================================
	* Function: check need send alert or not
	* To prevent sending too many messages
	=======================================================*/
	shouldGenerateAlert(deviceInfo) {
		var flag = true;
		const now = new Date();
		const { location, deviceId, temperature, humidity } = deviceInfo;
		const deviceKey = `key_${location}`;
		const lastAlert = this.lastAlertTime.get(deviceKey);

		if (lastAlert) {
			const minutesSinceLastAlertT = (now - lastAlert) / (1000 * 60);
			if (minutesSinceLastAlertT < this.alertCooldownMinutes) {
				console.log(`😉 Alert message already sent at ${lastAlert} `);
				flag = false;
			}else{
				flag = true;
			}
		}

		return flag;
	}

	/*=====================================================
	* Function: Process Zigbee sensor reading
	=======================================================*/
	async processTemperatureReading(deviceInfo) {
		const status = this.getTemperatureStatus(deviceInfo.temperature);
		const isCritical = deviceInfo.temperature > this.criticalTemperature;

		console.log(`🌡️ ${deviceInfo.location}/${deviceInfo.deviceId}: - Temperature:  ${deviceInfo.temperature}°C (${status.description}), Humidity: ${deviceInfo.humidity}% `);

		if (this.shouldGenerateAlert(deviceInfo)) {
		    await this.sendTemperatureAlert(deviceInfo, status);
		}
	}

	/*=====================================================
	* Function: general Alert Message
	=======================================================*/
	async sendTemperatureAlert(deviceInfo, status) {
		try {
			const alertData = {
				alert_type: "temperature_alert",
				device_id: deviceInfo.deviceId,
				location: deviceInfo.location,
				temperature: deviceInfo.temperature,
				temperature_status: status.description,
				humidity: deviceInfo.humidity,
				alert_level: status.alertLevel,
				is_critical: deviceInfo.temperature > this.criticalTemperature,
				critical_threshold: this.criticalTemperature,
				timestamp: deviceInfo.timestamp,
				topic: deviceInfo.topic,
				battery_level: deviceInfo.battery,
				link_quality: deviceInfo.linkquality
			};

			console.log(`⚡ Checking Temperature & Humidity for ${deviceInfo.location}`);

			var needSendAlertTemperature = false
			var needSendAlertHumidity = false
			var promptTemp = `current: ${alertData.temperature}°C, Target: ${this.criticalTemperature}°C, Rule: Alert only if current > target, Is ${alertData.temperature} > ${this.criticalTemperature}? Answer Yes or No ONLY. `;
			var promptHumidity = `current: ${alertData.humidity}, Target: ${this.criticalHumidity}, Rule: Alert only if current > target, Is ${alertData.humidity} > ${this.criticalHumidity}? Answer Yes or No ONLY. `;

			const alertMsgTemp = await this.callOllamaModel(JSON.stringify(alertData), promptTemp);  // based on the prompt, it only return "Yes" or "No"
			const alertMsgHumidity = await this.callOllamaModel(JSON.stringify(alertData), promptHumidity);  // based on the prompt, it only return "Yes" or "No"

			if(alertMsgTemp.trim().includes('Yes') || alertMsgHumidity.trim().includes('Yes')){
				console.log(`😡 ${alertData.location} Something wrong! Prepare to send alert message!`)

				const deviceKey = `key_${deviceInfo.location}`;
				this.lastAlertTime.set(deviceKey, new Date());

				var alert = "";

				if(alertMsgTemp.trim().includes('Yes') && alertMsgHumidity.trim().includes('Yes')){
					alert = "Temperature & Humidity";
				}else if(alertMsgTemp.trim().includes('Yes')){
					alert = "Temperature";
				}else{
					alert = "Humidity";
				}

				await this.sendNotifications(deviceInfo, alert);
			}else{
				console.log(`😁 ${alertData.location} Temperature and Humidity are okay. Nothing need to do.`)
			}

		} catch (error) {
			console.error('❌ Error generating temperature alert:', error.message);
		}
	}

	/*=====================================================
	* Function: call Ollama AI model
	=======================================================*/
	async callOllamaModel(jsonData, prompt) {
		try {
			const jsObject = JSON.parse(jsonData);
			const payload = {
				model: `${this.ollamaConfig.model}`, 
				prompt: `${prompt}`,
				stream: false, // Set to true for streaming responses
				options: {
					temperature: 0.0, // No randomness for consistent logic
					top_p: 0.1,       // Further reduce randomness
					max_tokens: 5,
					// Force cleanup
					num_ctx: 1024,  // Limit context window
					keep_alive: 0   // Don't keep model loaded
					}
			};
			const response = await fetch(this.ollamaConfig.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			return data.response;
		} catch (error) {
		    console.log('Oop, something wrong! Ollama unhealthy, restarting...');
		    exec('docker container restart ollama');
		    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s

		    return `❌ Error calling Ollama model: ${error.message}, docker container "ollama" restarted.`;
		}
	}

	/*=====================================================
	* Function: Send notification
	=======================================================*/
	async sendNotifications(deviceInfo, alertScope) {

		const thresholdT = `🔥 Critical Temperature: ${this.criticalTemperature}°C`
		const thresholdH = `💦 Critical Humidity: ${this.criticalHumidity}%`

		var alertMessage = `ALERT!\n ${".".repeat(60)}\n 📍 ${deviceInfo.location}\n 💧 ${deviceInfo.humidity}%\n `;
		alertMessage = alertMessage + `🌡️ ${deviceInfo.temperature}°C\n 🚨 ${alertScope} \n 📆 ${new Date(deviceInfo.timestamp).toLocaleString()} !\n `;
		alertMessage = alertMessage + `${".".repeat(60)}\n ${thresholdT}\n${thresholdH}`;

		await Promise.all([
		        this.sendTelegramAlert(deviceInfo, alertMessage)
		]);
	}

	/*=====================================================
	* Function: Telegram send message
	=======================================================*/
	async sendTelegramAlert(deviceInfo, alertMessage) {
		if (!this.telegramConfig.botToken || !this.telegramConfig.chatIds) {
		    console.log('⚠️ Telegram not configured - skipping Telegram alert');
		    return;
		}

		try {
		    const message = `⚠️ ${alertMessage} \n\n *IMMEDIATE ACTION REQUIRED*`;
		    const telegramUrl = `https://api.telegram.org/bot${this.telegramConfig.botToken}/sendMessage`;

		    const promises = this.telegramConfig.chatIds.map(chatId =>
		      {
		        fetch(telegramUrl, {
		            method: 'POST',
		            headers: { 'Content-Type': 'application/json' },
		            body: JSON.stringify({
		                chat_id: chatId,
		                text: message,
		                parse_mode: 'Markdown',
		                disable_notification: false // Ensure notification sound plays
		            })
		        })
		      }
		    );

		    await Promise.all(promises);
		    console.log(' ʟ✅ Telegram alerts sent successfully');

		} catch (error) {
		    console.error(' ʟ❌ Failed to send Telegram alert:', error.message);
		}
	}

	// Add health check
	async checkOllamaHealth() {
	    try {
	        const response = await fetch('http://localhost:11434/api/tags');
	        return response.ok;
	    } catch {
	        return false;
	    }
	}

	async disconnect() {
		if (this.mqttClient) {
		    this.mqttClient.end();
		    console.log('🔌 Disconnected from MQTT broker');
		}
	}
}
// class :: End


/*=====================================================
* class: Configuraion
=======================================================*/
class Configuration{
		constructor(){
			const env = process.env.NODE_ENV || 'dev';
			dotenv.config({ path: `.env.${env}` });

			this.config = {
				mqtt: {
				host: 'localhost',
				port: 1883,
				username: null, // Set your MQTT credentials
				password: null
			},
			ollama: {
				url: 'http://localhost:11434/api/generate',
				eng_model: `${process.env.OLLAMA_MODEL}`,
				chn_model: `${process.env.OLLAMA_MODEL_TW_CHN}`,
			},
			telegram: {
				botToken: `${process.env.TLG_BOT_TOKEN}`,
				chatIds: [`${process.env.TLG_CHAT_ID_LIST}`]
			},
			housekeeperBee:{
				url: `${process.env.HOUSEKEEPER_BEE_URL}`,
				admin_url: `${process.env.HOUSEKEEPER_BEE_ADMIN_URL}`,
				apiKey: `${process.env.HOUSEKEEPER_BEE_API_KEY}`,
				enabled: `${process.env.HOUSEKEEPER_BEE_ENABLED}`
			}
		};

		this.temperatureThreshold = process.env.TEMPERATURE_THRESHOLD;
		this.humidityThreshold = process.env.HUMIDITY_THRESHOLD;
		this.coolDownTime = process.env.SENSOR_COOL_DOWN_TIME;

	}
}

/*=====================================================
* Function: Main
=======================================================*/
async function main() { 

	const setting = new Configuration();

	const housekeeperBeeAiTools = new HousekeeperBeeAiTools(
					'http://localhost:11434' ,
					setting.config.ollama.chn_model,
					setting.config.telegram.botToken ,
					setting.config.telegram.chatIds,
					setting.config.housekeeperBee
					);

	const alertSystem = new MQTTTemperatureAlertSystem(
					setting.config,
					setting.temperatureThreshold,
					setting.humidityThreshold,
					setting.coolDownTime
					);

	console.log('🚀 Starting Critical Temperature Alert System...');
	console.log(`🔥 Critical Temperature threshold: ${setting.temperatureThreshold}°C`);
	console.log(`💦 Critical Humidity threshold: ${setting.humidityThreshold}%`);
	console.log(`🕙 Alert send interval: ${setting.coolDownTime}`);
	console.log('📱 Telegram notifications enabled');

	try {
		await alertSystem.init();

		process.on('SIGINT', async () => {
		    console.log('\n🛑 Shutting down gracefully...');
		    await alertSystem.disconnect();
		    process.exit(0);
		});
	} catch (error) {
		console.error('❌ Failed to start system:', error.message);
		process.exit(1);
	}

}

export default MQTTTemperatureAlertSystem;

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

