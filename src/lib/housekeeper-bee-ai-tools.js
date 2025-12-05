/*  NOTE
We are using Visual Studio Code extension, "Comment Anchor" in Windows. 
It is a tool that creates bookmarks for specific points within your code's comments or strings, helping you to navigate and organize your work.
You may need use dos2unix to convert plain text files in DOS or Mac format to Unix format and vice versa after deployed to Linux environment.
*/
const { default: TelegramBot } = await import('node-telegram-bot-api');
import { ZigbeeDeviceManager, ZigbeeDeviceAnalyst } from './zigbee-devices.js';
import fetch from 'node-fetch';
import { Ollama } from "ollama";
import { execSync } from 'child_process';
import { marked } from 'marked';
import { SessionStore } from './redis-manager.js';


class HousekeeperBeeAiTools {
	constructor(host = 'http://localhost:11434', model = 'llama3.2', botToken, chatIds, housekeeperBeeConfig = {}) {

		//Ollama
		this.host = host;
		this.model = model;
		this.ollamaEnv = process.env.OLLAMA_ENV;
		this.ollamaInitErr = false

		if (this.ollamaEnv === 'cloud') {
			var version = Number(execSync(`docker exec ollama ollama -v | cut -d ' ' -f 4 | cut -d '.' -f 2`, { encoding: 'utf-8' }) || 0);

			if (version >= 12) {
				this.ollama = new Ollama({
					host: "https://ollama.com",
					headers: {
						Authorization: "Bearer " + process.env.OLLAMA_API_KEY,
					},
				});
			} else {
				this.ollamaInitErr = true;
				console.log('version problem');
			}
		}

		//Telegram
		this.telegramSessionStore = new SessionStore('telegram');
		this.clearPromptHistory = false;

		this.botToken = botToken;
		this.chatIds = chatIds;
		this.processingFlag = false;

		this.bot = new TelegramBot(botToken, { polling: true });
		this.handleMessage = this.handleMessage.bind(this);
		this.bot.on('message', this.handleMessage);

		this.callerChartId = 9999999;
		this.zigbeeDeviceAnalyst = new ZigbeeDeviceAnalyst('mqtt://localhost:1883');

		this.beeUrl = housekeeperBeeConfig.url
		this.beeApiKey = housekeeperBeeConfig.apiKey
		this.beeEnabled = (housekeeperBeeConfig.enabled.toLowerCase() === 'true' || housekeeperBeeConfig.enabled.toLowerCase() === 'yes' || housekeeperBeeConfig.enabled.toLowerCase() === 'enable' ? true : false);
		this.beeAdminUrl = housekeeperBeeConfig.admin_url

		// Timeout handler 
		this.abortController = null;
		this.typingInterval = null;   // show typing when processing the request, like find storage box, get zigbee state
		this.timeoutHdrId = null;
		this.REQUEST_TIMEOUT = 4 * 60 * 1000; // 4 minutes
	}

	/***********************************************
	// SECTION - Functions
	***********************************************/

	//ANCHOR - Timeout long run request
	newTimeoutHandler(interval) {
		return setInterval(async () => {
			try {
				if (this.processingFlag) {
					if (this.typingInterval != null) {
						clearInterval(this.typingInterval);
						this.typingInterval = null;
					}

					if (this.abortController != null) {
						this.abortController.abort();
						this.abortController = null;
					}
					this.processingFlag = false;
				}
			} catch (error) {
				console.log(error);
			}

		}, interval
		);
	}

	// ANCHOR - Check string is a TW Chinese
	containsChinese(str) {
		const regex = /\p{Script=Han}/u;
		return regex.test(str);
	};

	// ANCHOR - Math rounding
	roundUpToOneDecimalPlace(num) {
		return Math.ceil(num * 10) / 10;
	}

	// ANCHOR - add Minutes
	addMinutes(date, minutesToAdd) {
		const newDate = new Date(date); // Create a copy to avoid side effects
		newDate.setMinutes(newDate.getMinutes() + minutesToAdd);
		return newDate;
	}

	// ANCHOR - Remove Telegram unsupported tags but keep content
	sanitizeHtmlForTelegram(html) {
		return html
			.replace(/<\/?p>/g, '\n')
			.replace(/<\/?div>/g, '\n')
			.replace(/<\/?span[^>]*>/g, '')
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/?h[1-6]>/g, '')
			.replace(/<\/?ul>/g, '\n')
			.replace(/<\/?ol>/g, '\n')
			.replace(/<\/?li>/g, '\n• ')
			.replace(/<\/?table[^>]*>/g, '\n')
			.replace(/<\/?tbody[^>]*>/g, '')
			.replace(/<\/?thead[^>]*>/g, '')
			.replace(/<\/?tr[^>]*>/g, '\n')
			.replace(/<\/?td[^>]*>/g, ' ')
			.replace(/<\/?th[^>]*>/g, ' ')
			.replace(/<\/?hr>/g, '\n')

			// Clean up multiple newlines
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}

	// ANCHOR - Remove empty rows from HTML content
	removeEmptyRowsRegex(html) {
		return html
			// Remove empty table rows
			.replace(/<tr>\s*<\/tr>/gi, '')
			.replace(/<tr>\s*<td>\s*<\/td>\s*<\/tr>/gi, '')
			.replace(/<tr>\s*<th>\s*<\/th>\s*<\/tr>/gi, '')

			// Remove empty paragraphs
			.replace(/<p>\s*<\/p>/gi, '')

			// Remove empty divs
			.replace(/<div>\s*<\/div>/gi, '')

			// Remove empty spans
			.replace(/<span>\s*<\/span>/gi, '')

			// Remove empty list items
			.replace(/<li>\s*<\/li>/gi, '')

			// Remove multiple newlines
			.replace(/\n{3,}/g, '\n\n')

			.replace(/`/g, "")
            .replace(/• \n/g, "")
            .replace(/•\n/g, "")

			.trim();
	}

	// !SECTION - End of Functions Implementation

	/************************************************************** 
	* SECTION - AI Tools implementation
	***************************************************************/

	// ANCHOR - clear prompt history from redis
	async deletePromptHistory() {
		this.clearPromptHistory = true;
	}

	// ANCHOR - Get all zigbee device profiles
	async getAllZigbeeDevice() {

		const zigbeeManager = new ZigbeeDeviceManager();
		var devices = null
		var onlineDevices = null;

		try {
			await zigbeeManager.connect();
			console.log('Waiting for device discovery...');
			await new Promise(resolve => setTimeout(resolve, 3000));
			devices = await zigbeeManager.requestDevicesList();

			// Get online devices
			onlineDevices = zigbeeManager.getOnlineDevices();
		} catch (error) {
			console.log('Error: ', error);
		} finally {
			// Clean up
			setTimeout(() => {
				zigbeeManager.disconnect();
			}, 1000);
		}

		return { devices, onlineDevices };
	}


	// ANCHOR - Get all zigbee temperature and humidity device state
	async getAllZigbeeRHnTempDevice() {

		const zigbeeManager = new ZigbeeDeviceManager();
		var devices = null

		try {
			await zigbeeManager.connect();
			await new Promise(resolve => setTimeout(resolve, 3000));
			devices = await zigbeeManager.getDevicesByType('Temperature and Humidity');
		} catch (error) {
			console.log('Error: ', error);
		} finally {
			// Clean up
			setTimeout(() => {
				zigbeeManager.disconnect();
			}, 1000);
		}

		return devices;
	}

	// ANCHOR - Get ZigBee Temperature and Humidity device reading
	async getAllTemperatureAndHumiditySensor() {

		const devices = await this.getAllZigbeeRHnTempDevice();

		var rsp = ['Temperature and Humidity devices state'];

		if (devices) {
			var temperatureUnit = '';

			devices.forEach((device, index) => {
				const exposes = device.definition.exposes.filter(ex => ex.description.includes('temperature value'));

				if (exposes) {
					temperatureUnit = exposes[0].unit;
				}
				rsp.push(`${index + 1}. ${device.friendly_name}`);
				rsp.push(`Temperature: ${device.lastData.temperature}${temperatureUnit}`);
				rsp.push(`Humidity: ${device.lastData.humidity}%`);
				rsp.push(`Battery: ${device.lastData.battery}%`);
				rsp.push('');
			});
		} else {
			rsp.push('No devices found!');
		}
		return rsp.join('\n');
	}

	// ANCHOR - Power on a device
	async switchOnPlug(deviceName) {
		try {
			const { devices } = await this.getAllZigbeeDevice();

			if (devices) {
				const device = devices.filter(dev => dev.friendly_name === deviceName);

				if (device) {
					const states = await this.zigbeeDeviceAnalyst.getDeviceState(deviceName);

					if (`${states.mode || 'unknown'}` === 'switch') {
						if (states.state === 'OFF') {
							const okayFlag = await this.zigbeeDeviceAnalyst.publishMsgToDevice(device[0].ieee_address, `{ "state": "ON" }`);

							return (okayFlag ? 'Switched On' : 'Failed');
						} else {
							return 'Already On';
						}
					} else {
						return 'Unsupported Device Type.';
					}
				}
			}
			return 'Device not found!'
		} catch (error) {
			console.log(error);
			return 'Device not found!'
		}
	}

	// ANCHOR - Power off a device
	async switchOffPlug(deviceName) {
		try {
			const { devices } = await this.getAllZigbeeDevice();

			if (devices) {
				const device = devices.filter(dev => dev.friendly_name === deviceName);

				if (device) {
					const states = await this.zigbeeDeviceAnalyst.getDeviceState(deviceName);

					if (`${states.mode || 'unknown'}` === 'switch') {
						if (states.state === 'ON') {
							const okayFlag = await this.zigbeeDeviceAnalyst.publishMsgToDevice(device[0].ieee_address, `{ "state": "OFF" }`);

							return (okayFlag ? 'Switched Off' : 'Failed');
						} else {
							return 'Already Off';
						}
					} else {
						return 'Unsupported Device Type.';
					}
				}
			}
			return 'Device not found!'
		} catch (error) {
			console.log(error);
			return 'Device not found!'
		}

	}

	// ANCHOR - Switch on/ off device
	async clickButton(deviceName) {
		try {
			const { devices } = await this.getAllZigbeeDevice();

			if (devices) {
				const device = devices.filter(dev => dev.friendly_name === deviceName);

				if (device) {
					const states = await this.zigbeeDeviceAnalyst.getDeviceState(deviceName);

					if (`${states.mode || 'unknown'}` === 'click') {
						const cmd = (states.state === 'ON' ? 'OFF' : 'ON');
						const okayFlag = await this.zigbeeDeviceAnalyst.publishMsgToDevice(device[0].ieee_address, `{ "state": "${cmd}" }`);

						return (okayFlag ? 'Pressed' : 'Failed');
					} else {
						return 'Unsupported Device Type.';
					}
				}
			}
			return 'Device not found!'
		} catch (error) {
			console.log(error);
			return 'Device not found!'
		}
	}

	// ANCHOR - show AI tools help
	showHelp() {
		var cnt = 1;
		var desc = ['==== Function List ===='];

		this.tools.forEach((tool, index) => {
			if (tool.display) {
				desc.push(`${cnt}. ${tool.title}`);
				desc.push(tool.detail);
				desc.push('');
				cnt = cnt + 1;
			}
		});

		desc.push('To use Housekeeper Bee server tools, please set HOUSEKEEPER\\_BEE\\_ENABLED to true from .env.prod file.');

		return desc.join('\n');
	}

	// ANCHOR - Get Zigbee device state
	async getDeviceState(deviceName) {
		var temperatureUnit = '°C';
		var results = [];

		try {
			const deviceState = await this.zigbeeDeviceAnalyst.getDeviceState(deviceName);

			results.push(deviceName);

			if (deviceState) {
				if (deviceState.temperature) {
					if (deviceState.temperature_units) {
						temperatureUnit = (deviceState.temperature_units === 'celsius' ? '°C' : '°F')
					}
					results.push(`Temperature: ${deviceState.temperature} ${temperatureUnit}`);
				}

				if (deviceState.humidity) { results.push(`Humidity: ${deviceState.humidity}%`); }
				if (deviceState.battery) { results.push(`Battery: ${deviceState.battery}%`); }
				if (deviceState.state) { results.push(`State: ${deviceState.state}`); }
				if (deviceState.reverse) { results.push(`Reverse: ${deviceState.reverse}`); }
				if (deviceState.touch) { results.push(`Touch: ${deviceState.touch}`); }
				if (deviceState.mode) { results.push(`Touch: ${deviceState.mode}`); }
			}
		} catch (error) {
			results.push('Error getting device state:', error.message);
		}

		return results.join('\n');
	}

	// ANCHOR - Get all zigbee device list
	async showZigBeeDevicesList() {
		const { devices, onlineDevices } = await this.getAllZigbeeDevice();

		var results = ['\n=== All Zigbee Devices ==='];

		if (devices != null && onlineDevices != null) {
			devices.forEach((device, index) => {
				results.push(`${index + 1}. ${device.friendly_name}`);
				results.push(`Status: ${device.status}`);
				results.push(`Battery: ${device.lastData.battery}%`);
				results.push(`Mode: ${device.lastData.mode || '-:-'}`);
				results.push(`Vendor: ${device.definition?.vendor || 'Unknown'}`);
				results.push(`${device.definition.description}`)
				results.push('');
			});

			results.push(`\n=== Summary ===`);
			results.push(`Total: ${devices.length}`);
			results.push(`Online: ${onlineDevices.length}`);
		}

		return results.join('\n');
	}

	// ANCHOR - Get Zigbee device profile by friendly name/ device name
	async showZigBeeDeviceByName(deviceName) {
		var { devices, onlineDevices } = await this.getAllZigbeeDevice();
		var results = [`\n=== ${deviceName} Details ===`];

		if (devices != null && onlineDevices != null) {
			devices = devices.filter(device => device.friendly_name === deviceName);
			onlineDevices = onlineDevices.filter(device => device.friendly_name === deviceName);

			devices.forEach((device, index) => {
				results.push(`${index + 1}. ${device.friendly_name}`);
				results.push(`   IEEE Address: ${device.ieee_address}`);
				results.push(`   Battery: ${device.lastData.battery}%`);
				results.push(`   Type: ${device.type}`);
				results.push(`   Model: ${device.model_id || 'Unknown'}`);
				results.push(`   Vendor: ${device.definition?.vendor || 'Unknown'}`);
				results.push(`   Status: ${device.status}`);
				results.push(`   Last Seen: ${device.lastSeen || 'Never'}`);
				results.push('');
			});
		}

		return results.join('\n');
	}

	// ANCHOR - Message handler
	async handleMessage(msg) {
		var tm2LiveInMin = process.env.TLG_TTL_IN_MINUTE || 15;
		tm2LiveInMin = Number((tm2LiveInMin >= 5 && tm2LiveInMin <= 720 ? tm2LiveInMin : 15));

		const tm2LiveInMs = tm2LiveInMin * 60 * 1000;
		const tm2LiveInMsMsg = 5 * 60 * 1000;
		const matchedChatId = this.chatIds.filter(chatId => chatId == msg.chat.id);

		if (matchedChatId.length != 1) {
			this.sendTelegramMsg('Access Denied. Contact Administator.', false, 0)
		} else {
			this.callerChatId = msg.chat.id;

			setTimeout(async () => {
				await this.delMsg(this.callerChatId, msg.message_id);
			}, tm2LiveInMs);

			if (!this.processingFlag) {
				this.sendTelegramMsg('Ok, it may takes a few minutes.', true, tm2LiveInMsMsg);
				this.processingFlag = true;

				if (this.timeoutHdrId != null) { clearInterval(this.timeoutHdrId); this.timeoutHdrId = null; }

				if (this.ollamaEnv === 'local') {
					this.timeoutHdrId = this.newTimeoutHandler(this.REQUEST_TIMEOUT);
				}

				try {
					const originalTime = new Date();
					const msgDelTm = this.addMinutes(originalTime, tm2LiveInMin);
					const response = await this.chat(msg.text);
					this.sendTelegramMsg(response, false, tm2LiveInMs);
					this.sendTelegramMsg(`The result will be deleted on ${msgDelTm.toLocaleString()}`, false, tm2LiveInMs);
				} catch (error) {
					console.log(error);
				}

				this.processingFlag = false;

				if (this.timeoutHdrId != null) { clearInterval(this.timeoutHdrId); this.timeoutHdrId = null; }

			} else {
				this.sendTelegramMsg('Processing privous request, please wait!', true, tm2LiveInMsMsg);
			}
		}
	}

	// ANCHOR - Delete message
	async delMsg(aCallerId, aMsgId) {
		try {
			await fetch(`https://api.telegram.org/bot${this.botToken}/deleteMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: aCallerId,
					message_id: aMsgId
				})
			});
		} catch (err) {
			console.log(err);
		}
	}

	// ANCHOR - Telegram send message
	async sendTelegramMsg(msg, isShowTyping, ttl) {
		try {

			if (this.typingInterval != null) {
				clearInterval(this.typingInterval);
				this.typingInterval = null;
			}

			const telegramUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

			const response = await fetch(telegramUrl,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify
						({
							chat_id: this.callerChatId,
							text: msg,
							parse_mode: 'Html',   // Markdown or HTML,
							disable_notification: false // Ensure notification sound plays
						})
				})

			if (isShowTyping) {
				this.typingInterval = setInterval(async () => {

					try {
						await fetch(`https://api.telegram.org/bot${this.botToken}/sendChatAction`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ chat_id: this.callerChatId, action: 'typing' }),
						});
					} catch (err) {
					}

				}, 5 * 1000);
			}

			if (ttl > 0) {
				const data = await response.json();

				if (data.ok) {
					const messageId = data.result.message_id;

					setTimeout(async () => {
						await this.delMsg(this.callerChatId, messageId);
					}, ttl);
				} else {
					this.sendTelegramMsg(`Error(${data.error_code}): ${data.description}`, false, ttl);
				}
			}
		} catch (error) {
			console.error(' ʟ❌ Failed to send Telegram alert:', error.message);
		}
	}

	// ANCHOR -  Housekeeper Bee :: count number of stroage box
	// Housekeeper Bee related
	async countStorageBoxes(keyword) {

		let storages = await this.showAllStorageBoxes(keyword, false);
		let filteredRst = storages.split('\n').filter(record => record.includes('📦'));

		return `Number of storage boxes: ${filteredRst.length}`;
	}

	//ANCHOR - Housekeeper Bee :: Find stored Item from strorage box
	async findStorageBoxsItem(itemName) {

		const item = itemName;

		if (this.beeEnabled) {

			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

			const response = await fetch(`${this.beeUrl}/api/housekeeping/storage/mcp/findStorageBox/\*/false`, {
				headers: {
					'x-api-key': `${this.beeApiKey}`,
				},
			});

			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

			if (!response.ok) {
				console.log(`Error fetching data: ${response.status} ${response.statusText}`)
			}

			var jsonData = await response.json();

			jsonData = jsonData.filter(o => o.storageDesc.toLowerCase().includes(item.toLowerCase()))

			if (jsonData.length == 0) {
				return `${item} Not found!`
			} else {
				var result = [`Search Result of ${item}`];

				jsonData.forEach((obj, index) => {
					result.push(`📍: ${obj.locationName}`);
					result.push(`📦: ${obj.storageName}`);
					result.push('📝:');
					result.push(obj.storageDesc);
					result.push('');
				});

				return result.join('\n');
			}
		} else {
			if (!this.beeEnabled) {
				return 'Housekeeper Bee integration disabled!';
			} else {
				return 'Keyword Not Found!'
			}
		}
	}


	// ANCHOR - Housekeeper Bee :: List all storage boxes and location name
	async showAllStorageBoxes(boxName, isShowDetail) {
		const show_detail = isShowDetail;
		const filter_box_name = boxName;

		if (this.beeEnabled) {

			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

			const response = await fetch(`${this.beeUrl}/api/housekeeping/storage/mcp/findStorageBox/\*/false`, {
				headers: {
					'x-api-key': `${this.beeApiKey}`,
				},
			});

			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

			if (!response.ok) {
				console.log(`Error fetching data: ${response.status} ${response.statusText}`)
			}

			var jsonData = await response.json();

			if (jsonData.length == 0) {
				return `Error: Not found!`
			} else {

				var result = [`Search result:`];

				if (filter_box_name) {
					jsonData = jsonData.filter(b => b.storageName.includes(filter_box_name, 0));
				}

				var boxName = '';

				jsonData.forEach((obj, index) => {
					if (boxName != obj.locationName) {
						result.push('');
						result.push(`📍: ${obj.locationName}`);
						boxName = obj.locationName;
					}

					result.push(`📦: ${obj.storageName}`);

					if (show_detail) {
						result.push(`🏷️:${obj.barcode}`);
						result.push(`📋:${obj.storageDesc}`);
						result.push('');
					}
				});

				result.push('\n');
				result.push(`Total location: ${result.filter(record => record.includes('📍')).length}`);
				result.push(`Total storage box: ${result.filter(record => record.includes('📦')).length}`);

				return result.join('\n');
			}
		} else {
			if (!this.beeEnabled) {
				return 'Error: Housekeeper Bee integration disabled!';
			} else {
				return 'Error: Keyword Not Found!'
			}
		}
	}

	//Housekeeper Bee :: get Housekeeper Bee server status
	async getHseBeeSrvState() {
		if (this.beeEnabled) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

			const response = await fetch(`${this.beeAdminUrl}/api/housekeeping/admin/system/mcp/getSysInfo`, {
				headers: {
					'x-api-key': `${this.beeApiKey}`,
				},
			});

			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

			if (!response.ok) {
				console.log(`Error fetching data: ${response.status} ${response.statusText}`)
			}

			var jsonData = await response.json();

			if (jsonData.length == 0) {
				return `Housekeeper Bee serevr no response!`
			} else {

				var result = [`Housekeeper Bee Server status:`];

				result.push(`System Uptime: ${jsonData.sysUptime}`);
				result.push(`CPU temperature: ${this.roundUpToOneDecimalPlace(jsonData.cpuTemperature)}°C `);
				result.push(`IO temperature: ${this.roundUpToOneDecimalPlace(jsonData.ioTemperature)}°C`);
				result.push(jsonData.sleepDetail);

				return result.join('\n');
			}
		} else {
			if (!this.beeEnabled) {
				return 'Housekeeper Bee integration disabled!';
			} else {
				return 'getHseBeeSrvState bugs.'
			}
		}
	}

	// !SECTION - End of AI Tools Implementaion


	/************************************************************** 
	* SECTION - AI Tool Definition
	***************************************************************/
	tools = [
		{
			//ANCHOR - Switch on device
			type: 'function',
			function: {
				name: 'switchOnPlug',
				description: 'Switch on an electronic device by device name. The device name should be enclosed in double quotation marks. Ignores keywords like "open".',
				parameters: {
					type: 'object',
					required: ['device_name'],
					properties: {
						device_name: {
							type: 'string',
							description: 'The name of the device to power on'
						}
					}
				}
			},
			display: true,
			title: 'Power On Zigbee Device',
			detail: 'Turns on a Zigbee-connected device. Example: Power on "ada bedroom fan plug". Device names must be enclosed in double quotation marks.'
		},
		{
			//ANCHOR - Switch off device
			type: 'function',
			function: {
				name: 'switchOffPlug',
				description: 'Switch off an electronic device by device name. The device name should be enclosed in double quotation marks. Ignores keywords like "close".',
				parameters: {
					type: 'object',
					required: ['device_name'],
					properties: {
						device_name: {
							type: 'string',
							description: 'The name of the device to power off'
						}
					}
				}
			},
			display: true,
			title: 'Power Off Zigbee Device',
			detail: 'Turns off a Zigbee-connected device. Example: Power off "ada bedroom fan plug". Device names must be enclosed in double quotation marks.'
		},
		{
			//ANCHOR - Show all ZigBee device profiles
			type: 'function',
			function: {
				name: 'showZigBeeDevicesList',
				description: 'Retrieves a complete list of all Zigbee device profiles, including device names, models, and functional descriptions.'
			},
			display: true,
			title: 'List All Zigbee Devices',
			detail: 'Displays comprehensive information about all connected Zigbee devices, including their current status and capabilities.'
		},
		{
			// ANCHOR - Get all temperature and humidity state
			type: 'function',
			function: {
				name: 'getAllTemperatureAndHumiditySensor',
				description: 'Retrieves current readings from all connected temperature and humidity sensors in the system.'
			},
			display: true,
			title: 'Get All Temperature & Humidity Readings',
			detail: 'Shows current temperature and humidity data from all environmental sensors. Example: "Show all temperature devices" or "Display humidity readings".'
		},
		{
			// ANCHOR - Show help menu
			type: 'function',
			function: {
				name: 'showHelp',
				description: 'Displays the help menu with available commands and usage information. Supports the "?" shortcut.',
			},
			display: true,
			title: 'Display Help Menu',
			detail: 'Shows available commands and usage instructions. Example: "Help" or "?".'
		},
		{
			// ANCHOR - show ZigBee device profile by name
			type: 'function',
			function: {
				name: 'showZigBeeDeviceByName',
				description: 'Retrieves detailed profile information for a specific Zigbee device using its friendly name. The name must be enclosed in double quotation marks.',
				parameters: {
					type: 'object',
					required: ['device_name'],
					properties: {
						device_name: {
							type: 'string',
							description: 'The friendly name of the Zigbee device or sensor, typically enclosed in double quotation marks'
						}
					}
				}
			},
			display: true,
			title: 'Get Device Profile by device Name',
			detail: 'Retrieves detailed information about a specific device using its device name. Example: Get "ada bedroom" information. Names should be quoted.'
		},
		{
			// ANCHOR - Get ZigBee device state by device name
			type: 'function',
			function: {
				name: 'getDeviceState',
				description: 'Retrieves the current state of a Zigbee device by its name. The device name should be enclosed in double quotation marks without extra quotes.',
				parameters: {
					type: 'object',
					required: ['device_name'],
					properties: {
						device_name: {
							type: 'string',
							description: 'The Zigbee device name enclosed in double quotation marks'
						}
					}
				}
			},
			display: true,
			title: 'Get Device Current State',
			detail: 'Retrieves the current operational state of a device. Example: Get "ada bedroom" device state. Device names should be quoted.'
		},
		{
			// ANCHOR - Trigger click event of plug 
			type: 'function',
			function: {
				name: 'clickButton',
				description: 'Toggles a Zigbee device state (on/off) by simulating a button click, touch, or press action.',
				parameters: {
					type: 'object',
					required: ['device_name'],
					properties: {
						device_name: {
							type: 'string',
							description: 'Device name or friendly name. If quoted in double quotations, they will be removed before processing'
						}
					}
				}
			},
			display: true,
			title: 'Toggle Device State',
			detail: 'Switches a device between on and off states. Example: Press the "ada room fan" button.'
		},
		{
			// ANCHOR - Find stored item from storage boxes by item name or owner name 
			type: 'function',
			function: {
				name: 'findStorageBoxsItem',
				description: 'Searches for stored items across all storage boxes managed by Housekeeper Bee. Searches by item name or owner name. Top priority search tool when storage box name is not provided.',
				parameters: {
					type: 'object',
					required: ['item_name'],
					properties: {
						item_name: {
							type: 'string',
							description: 'The name of the stored item (e.g., "HDMI cable") or owner name to search for'
						}
					}
				}
			},
			display: true,
			title: 'Find Items in Storage Boxes',
			detail: 'Locates stored items across all storage boxes managed by Housekeeper Bee. Example: Find "USB cable" from storage boxes, or Find items belonging to Thomas.'
		},
		{
			// ANCHOR - Show All storage boxes information
			type: 'function',
			function: {
				name: 'showAllStorageBoxes',
				description: 'Lists all storage boxes with optional filtering by box name. Can display detailed contents if requested.',
				parameters: {
					type: 'object',
					required: ['show_detail', 'filter_box_name'],
					properties: {
						show_detail: {
							type: 'boolean',
							description: 'When true, displays stored items within boxes. Default is false'
						},
						filter_box_name: {
							type: 'string',
							description: 'Storage box name to filter results, may include owner name'
						}
					}
				}
			},
			display: false,
			title: 'List All Storage Boxes',
			detail: 'Displays all storage boxes managed by Housekeeper Bee with optional filtering and detail levels.'
		},
		{
			// ANCHOR - Get Housekeeper Bee Server State
			type: 'function',
			function: {
				name: 'getHseBeeSrvState',
				description: 'Retrieves the current status of the Housekeeper Bee server, including system health and operational metrics. The server manages all storage boxes and locations.'
			},
			display: true,
			title: 'Get Housekeeper Bee Server Status',
			detail: 'Displays the current status and health of the Housekeeper Bee server system. Example: Show Bee status.'
		},
		{
			// ANCHOR - Count total number of boxes
			type: 'function',
			function: {
				name: 'countStorageBoxes',
				description: 'Counts the total number of storage boxes, with optional keyword filtering by box name, owner name, or item description (e.g., toy, electronic). Default empty string returns count of all boxes.',
				parameters: {
					type: 'object',
					required: ['keyword'],
					properties: {
						keyword: {
							type: 'string',
							description: 'Optional filter keyword: storage box name, owner name, or item description. Empty string for all boxes'
						}
					}
				}
			},
			display: false,
			title: 'Count Storage Boxes',
			detail: 'Returns the total number of storage boxes matching the specified criteria.'
		},
		{
			// ANCHOR - Clear prompt history from redis
			type: 'function',
			function: {
				name: 'deletePromptHistory',
				description: 'Telegram users request to clear or delete the prompt history to enhance performance and data accuracy.'
			},
			display: true,
			title: 'Clear user prompt history',
			detail: 'It delete all user prompt history from redis database.'
		}

	];

	// !SECTION - End AI Tool Definition

	/************************************************************** 
	* AI Part
	***************************************************************/

	// ANCHOR - Chat with Ollama
	async chat(message) {

		if (this.ollamaInitErr) { return 'Ollama version should be 12 or higher...'; }

		var errMsg = "Unknown Error!";
		var response = {};
		var data = {};

		if(!this.telegramSessionStore.checkConnection()){
			await this.telegramSessionStore.connect();
			await this.telegramSessionStore.del(this.callerChatId);
		}else{
			if(this.clearPromptHistory){
				await this.telegramSessionStore.del(this.callerChatId);
				this.clearPromptHistory = false;
			}
		}

		const messages = await this.telegramSessionStore.getArray(this.callerChatId);

		messages.push({ role: 'user', content: message }); 

		try {
			const requestBody = {
				model: this.model,
				messages: messages,
				stream: false,
				think: (process.env.OLLAMA_THINKING === 'true' ? true : false),
				tools: this.tools,
				options: {
					repeat_penalty: 1,
					stop: [
						"<|im_start|>",
						"<|im_end|>"
					],
					temperature: 0.6,	// 0.0 (consistent and focused) -> 1.0 or higher (creative and less predictable) change the randomness for consistent logic
					top_k: 20,
					top_p: 0.95,		// Further reduce randomness
					max_tokens: 300,	// Number of words
					num_ctx: 4096,		// Limit context window 
					keep_alive: 1,		//  0 = Don't keep model loaded
					charset: 'utf-8'
				}
			};

			if (this.ollamaEnv === 'cloud') {
				const results = [];
				while (true) {

					response = await this.ollama.chat(requestBody);

					messages.push(response.message)
					//console.log('Thinking:', response.message.thinking)
					//console.log('Content:', response.message.content)

					const toolCalls = response.message.tool_calls ?? []

					if (toolCalls.length) {
						for (const call of toolCalls) {
							const result = await this[call.function.name](...Object.values(call.function.arguments)); // Call the tool function

							results.push(result); // Store original result
							messages.push({ role: 'tool', tool_name: call.function.name, content: String(result) })
						}
					} else {
						break
					}
				}

				await this.telegramSessionStore.saveArray(this.callerChatId, messages);

				if (messages.at(-1).content == null) {
					return results.toString();
				} else {
					//Formatting output in HTML 
					const content = messages.at(-1).content || '';
					const html = this.removeEmptyRowsRegex(this.sanitizeHtmlForTelegram(marked.parse(content)));
					return html;
				}

			} else if (this.ollamaEnv === 'local') {
				// Environment set to local.
				// When the AI model and processing are run on RPi 5 (4GB).
				// To enhance the user experience while running on RPi, each request is processed only once.

				if (this.abortController) {
					this.abortController.abort();
				}

				this.abortController = new AbortController();

				response = await fetch(`${this.host}/api/chat`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody),
					signal: this.abortController.signal
				});

				// Check if response is ok
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				messages.push(response.message);

				data = await response.json();

				// Check if tool calls exist
				if (data.message.tool_calls && data.message.tool_calls.length > 0) {

					let previousResult = null; // To store the result of the previous tool
					const results = [];

					for (const tool of data.message.tool_calls) {
						try {
							// Prepare arguments, incorporating the previous result if available
							const args = tool.function.arguments
								? Object.values(tool.function.arguments).map(arg => {
									return (arg === 'previousResult' && previousResult)
										? previousResult
										: arg;
								})
								: [];

							const result = await this[tool.function.name](...args); // Call the tool function
							results.push(result); // Store original result
							previousResult = result; // Update previousResult

							messages.push({ role: 'tool', tool_name: tool.function.name, content: String(result) })

						} catch (err) {
							console.error(`Error calling tool ${tool.function.name}:`, err);
							results.push(`Error calling tool ${tool.function.name}: ${err.message}`);
						}
					}

					if(messages.length > 5){
						messages.splice(0, 5);
					}

					await this.telegramSessionStore.saveArray(this.callerChatId, messages);

					const finalRst = results.filter((item, index) => {
						return results.indexOf(item) === index;
					});

					return finalRst.join('\n');  // Return an array of results
				}

				//no tools
				if (data.message == null) return "I cannot handle it.";

				const lastMessage = data.message.content;

				// Get the last line from the lastMessage
				let lastLine = "Sorry I don't know.";

				if (lastMessage) {
					const lines = lastMessage.split('\n'); // Split the content into lines
					lastLine = lines.filter(line => line.trim() !== '').pop(); // Use .pop() to get the last non-empty line
				}

				return lastLine;
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				errMsg = "Timeout - Request Aborted!";
			} else if (error.status_code === 401) {
				errMsg = "Unauthorized. Invalid API Key."
			} else {
				errMsg = "Oops! Something Wrong! " + error;
				await this.telegramSessionStore.del(this.callerChatId);
			}
		} finally {
			this.abortController = null;
		}

		return errMsg;
	}
}

export default HousekeeperBeeAiTools;
